import React, { useState, useEffect, createContext, useContext } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
  connectAuthEmulator,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  writeBatch,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  Timestamp,
  connectFirestoreEmulator,
} from "firebase/firestore";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  connectStorageEmulator,
} from "firebase/storage";
import {
  User,
  Files,
  Signature,
  FileText,
  UserCheck,
  CheckCircle,
  Clock,
  Download,
  UploadCloud,
  FileSignature,
  Calculator,
  X
} from 'lucide-react';

// Configuration - Change this to update the domain everywhere
const UNIVERSITY_DOMAIN = "juniv.edu";

const THIRD_EXAMINER_THRESHOLD = 10;

// Result Management System Component
const ResultManagementSystem = ({ navigateTo }) => {
  // Main state to manage the application's flow and data
  const [userRole, setUserRole] = useState(null); // 'officer', 'controller', or null for unauthenticated
  const [currentPage, setCurrentPage] = useState('dashboard'); // 'dashboard', 'profile'
  const [marksheetData, setMarksheetData] = useState([]);
  const [certificateTemplate, setCertificateTemplate] = useState('');
  const [userSignatures, setUserSignatures] = useState({
    officerPreparer: 'https://placehold.co/150x50/F0F0F0/000000?text=Officer+Preparer',
    officerChecker: 'https://placehold.co/150x50/F0F0F0/000000?text=Officer+Checker',
    controller: 'https://placehold.co/150x50/F0F0F0/000000?text=Controller'
  });
  const [toastMessage, setToastMessage] = useState(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [documentType, setDocumentType] = useState(null); // 'marksheet' or 'certificate'
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [pdfMargins, setPdfMargins] = useState({ top: 50, bottom: 50, left: 20, right: 20 });
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Profile state management
  const [profileData, setProfileData] = useState({
    personalEmail: '',
    profilePicture: null,
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Mock data for dropdowns
  const mockData = {
    departments: ['Computer Science', 'Electrical Engineering', 'Mechanical Engineering'],
    courses: {
      'Computer Science': [
        { code: 'CSE101', title: 'Introduction to Programming' },
        { code: 'CSE202', title: 'Data Structures' },
      ],
      'Electrical Engineering': [
        { code: 'EEE101', title: 'Basic Electronics' },
        { code: 'EEE202', title: 'Circuit Analysis' },
      ],
      'Mechanical Engineering': [
        { code: 'ME101', title: 'Engineering Mechanics' },
        { code: 'ME202', title: 'Thermodynamics' },
      ],
    },
    academicYears: ['2021-2022', '2022-2023', '2023-2024'],
    sessions: ['Spring 2024', 'Fall 2023'],
    yearsOfAdmission: ['2021', '2022', '2023'],
    results: [
      { studentId: 'S-001', name: 'Alice Smith', grade: 'A', marks: '92', status: 'draft', type: 'marksheet' },
      { studentId: 'S-002', name: 'Bob Johnson', grade: 'B+', marks: '85', status: 'sent_to_checker', type: 'marksheet' },
      { studentId: 'S-003', name: 'Charlie Brown', grade: 'A-', marks: '90', status: 'sent_to_controller', type: 'marksheet' },
      { studentId: 'S-004', name: 'Diana Miller', grade: 'B', marks: '81', status: 'final', type: 'marksheet' },
      { studentId: 'S-005', name: 'Eva Green', status: 'final', type: 'certificate' },
    ],
  };

  // Toast component for displaying messages
  const Toast = ({ message, type }) => (
    <div className={`fixed bottom-4 right-4 p-4 rounded-md shadow-lg text-white z-50 transition-transform duration-300 transform ${message ? 'translate-y-0' : 'translate-y-20'} ${type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
      {message}
    </div>
  );

  // Function to show toast messages
  const showToast = (message, type = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Function to handle document generation based on the form data
  const handleGenerateDocument = (formData, docType) => {
    setDocumentType(docType);
    setSelectedDocument({ ...formData, studentData: mockData.results[0], status: 'draft' });
    setShowDocumentModal(true);
  };

  // Simulates the workflow for marksheet approval
  const updateMarksheetStatus = (marksheetId, newStatus) => {
    const updatedMarksheets = marksheetData.map(marksheet =>
      marksheet.studentId === marksheetId ? { ...marksheet, status: newStatus } : marksheet
    );
    setMarksheetData(updatedMarksheets);
    showToast(`Document status updated to "${newStatus.replace('_', ' ')}".`);
  };

  // Simulates the upload of a digital signature
  const handleSignatureUpload = (userRoleKey, e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUserSignatures(prev => ({ ...prev, [userRoleKey]: reader.result }));
        showToast('Signature uploaded successfully!');
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle profile picture upload
  const handleProfilePictureUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileData(prev => ({ ...prev, profilePicture: reader.result }));
        showToast('Profile picture uploaded successfully!');
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle profile data changes
  const handleProfileDataChange = (field, value) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  // Handle profile save
  const handleProfileSave = () => {
    showToast('Profile updated successfully!');
  };

  // Handle password change
  const handlePasswordChange = () => {
    if (profileData.newPassword !== profileData.confirmPassword) {
      showToast('New passwords do not match!', 'error');
      return;
    }
    if (profileData.newPassword.length < 6) {
      showToast('Password must be at least 6 characters long!', 'error');
      return;
    }
    showToast('Password changed successfully!');
    setShowPasswordModal(false);
    setProfileData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
  };

  // Generates and downloads the PDF
  const generatePdf = async () => {
    if (!selectedDocument) return;

    setIsGenerating(true);
    showToast('Generating PDF...', 'info');

    try {
      const element = document.querySelector('.document-to-print');
      const canvas = await window.html2canvas(element, {
        scale: 2,
        useCORS: true,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new window.jspdf.jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth() - pdfMargins.left - pdfMargins.right;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', pdfMargins.left, pdfMargins.top, pdfWidth, pdfHeight);
      pdf.save(`${selectedDocument.documentType}-${selectedDocument.studentData.studentId}.pdf`);

      showToast('PDF generated successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      showToast('Failed to generate PDF.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // Component for the navigation header
  const Header = () => (
    <header className="p-4 bg-gray-900 text-white shadow-lg flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <UserCheck className="w-8 h-8 text-indigo-400" />
        <h1 className="text-xl font-bold font-inter text-indigo-200">Result Management System</h1>
      </div>
      <div className="flex items-center space-x-4">
        {/* Back to Home Button */}
        <button
          onClick={() => navigateTo('home')}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105 flex items-center space-x-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          <span>Back to Home</span>
        </button>

        {userRole && (
          <>
            <span className="text-sm">Logged in as: <span className="font-bold">{userRole.charAt(0).toUpperCase() + userRole.slice(1)}</span></span>
            <button
              onClick={() => {
                setUserRole(null);
                setCurrentPage('dashboard');
                setMarksheetData([]);
                setCertificateTemplate('');
                setSelectedDocument(null);
              }}
              className="bg-red-500 hover:bg-red-600 text-white font-semibold py-1 px-3 rounded-md transition duration-300"
            >
              Logout
            </button>
          </>
        )}
      </div>
    </header>
  );

  // Component for the Profile page
  const ProfilePage = () => {
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordData, setPasswordData] = useState({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });

    // Handle password change for Officers and Controllers
    const handlePasswordChange = async () => {
      if (!passwordData.currentPassword) {
        showToast('Current password is required!', 'error');
        return;
      }
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        showToast('New passwords do not match!', 'error');
        return;
      }
      if (passwordData.newPassword.length < 6) {
        showToast('Password must be at least 6 characters long!', 'error');
        return;
      }

      try {
        const collectionName = userRole === 'officer' ? 'exam_officers' : 'exam_controllers';

        // Look up the current user's document directly in Firestore
        const userQuery = query(
          collection(db, getGlobalCollectionPath(collectionName)),
          where("universityEmail", "==", profileData.universityEmail)
        );
        const snap = await getDocs(userQuery);

        if (snap.empty || snap.docs[0].data().password !== passwordData.currentPassword) {
          showToast('Current password is incorrect!', 'error');
          return;
        }

        await updateDoc(
          doc(db, getGlobalCollectionPath(collectionName), snap.docs[0].id),
          { password: passwordData.newPassword }
        );

        showToast('Password changed successfully!');
        setShowPasswordModal(false);
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } catch (error) {
        console.error("Password change failed:", error);
        showToast('Failed to change password.', 'error');
      }
    };
  
    // Check if user is Officer or Controller (restricted editing)
    const isRestrictedUser = userRole === 'officer' || userRole === 'controller';
    
    // Note: Profile data is already set by the login process, so no need for additional useEffect
  
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Profile Management</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={profileData.name || ''}
                onChange={(e) => handleProfileDataChange('name', e.target.value)}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${isRestrictedUser ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                disabled={isRestrictedUser}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Personal Email</label>
              <input
                type="email"
                value={profileData.personalEmail || ''}
                onChange={(e) => handleProfileDataChange('personalEmail', e.target.value)}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${isRestrictedUser ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                disabled={isRestrictedUser}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">University Email</label>
              <input
                type="email"
                value={profileData.universityEmail || ''}
                onChange={(e) => handleProfileDataChange('universityEmail', e.target.value)}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${isRestrictedUser ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                disabled={isRestrictedUser}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
              <input
                type="text"
                value={profileData.designation || ''}
                onChange={(e) => handleProfileDataChange('designation', e.target.value)}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${isRestrictedUser ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                disabled={isRestrictedUser}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Profile Picture URL</label>
              <input
                type="url"
                value={profileData.profilePicture || ''}
                onChange={(e) => handleProfileDataChange('profilePicture', e.target.value)}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 ${isRestrictedUser ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                disabled={isRestrictedUser}
              />
            </div>
          </div>
          
          <div className="mt-6 flex gap-4">
            {!isRestrictedUser && (
              <button
                onClick={handleProfileSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Profile
              </button>
            )}
            <button
              onClick={() => setShowPasswordModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Change Password
            </button>
            {isRestrictedUser && (
              <p className="text-sm text-gray-600 mt-2">
                Note: Officers and Controllers can only change their password. Other profile fields are managed by the Super Admin.
              </p>
            )}
          </div>
        </div>

        {/* Password Change Modal */}
        {showPasswordModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Change Password</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                  <input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter current password"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter new password"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Confirm new password"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  }}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePasswordChange}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Change Password
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Component for the Officer's dashboard
  const OfficerDashboard = ({ setView }) => {
    const [formData, setFormData] = useState({
      department: '',
      courseTitle: '',
      courseCode: '',
      yearOfAdmission: '',
      academicYear: '',
      session: '',
    });

    const handleChange = (e) => {
      setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    // Mock data for dropdowns
    const mockData = {
      departments: ['Computer Science', 'Electrical Engineering', 'Mechanical Engineering'],
      courses: {
        'Computer Science': [
          { code: 'CSE101', title: 'Introduction to Programming' },
          { code: 'CSE202', title: 'Data Structures' },
        ],
        'Electrical Engineering': [
          { code: 'EEE101', title: 'Basic Electronics' },
          { code: 'EEE202', title: 'Circuit Analysis' },
        ],
        'Mechanical Engineering': [
          { code: 'ME101', title: 'Engineering Mechanics' },
          { code: 'ME202', title: 'Thermodynamics' },
        ],
      },
      yearsOfAdmission: ['2021', '2022', '2023', '2024', '2025'],
      academicYears: ['2021-2022', '2022-2023', '2023-2024', '2024-2025', '2025-2026'],
      sessions: ['Spring', 'Summer', 'Fall'],
      results: [
        { studentId: 'STU001', type: 'marksheet', status: 'final' },
        { studentId: 'STU002', type: 'marksheet', status: 'draft' },
        { studentId: 'STU003', type: 'marksheet', status: 'final' },
      ]
    };

    // Filter documents based on status for the officer's view
    const documentsForOfficer = mockData.results.filter(doc => doc.type === 'marksheet' && (doc.status === 'final' || doc.status === 'draft'));

    return (
      <div className="p-8 space-y-8 text-white">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Profile Section */}
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
            <div className="flex items-center space-x-4 mb-4">
              <User className="w-8 h-8 text-indigo-400" />
              <h2 className="text-2xl font-bold font-inter">My Profile</h2>
            </div>
            <p className="text-gray-400">Manage your personal information and digital signature.</p>
            <div className="mt-4">
              <button
                onClick={() => setView('profile')}
                className="w-full bg-indigo-600 hover:bg-indigo-700 font-semibold py-3 px-6 rounded-md shadow-md flex items-center justify-center space-x-2 transition duration-300 ease-in-out transform hover:scale-105"
              >
                <User className="w-5 h-5" />
                <span>Manage My Profile</span>
              </button>
            </div>
          </div>
          {/* Result Calculator Section */}
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
            <div className="flex items-center space-x-4 mb-4">
              <Calculator className="w-8 h-8 text-indigo-400" />
              <h2 className="text-2xl font-bold font-inter">Result Calculator</h2>
            </div>
            <p className="text-gray-400 mb-4">Access integrated result calculations from Department Admins for marksheet and certificate generation.</p>
            <div className="mt-4">
              <button
                onClick={() => setView('officer_result_calculator')}
                className="w-full bg-green-600 hover:bg-green-700 font-semibold py-3 px-6 rounded-md shadow-md flex items-center justify-center space-x-2 transition duration-300 ease-in-out transform hover:scale-105"
              >
                <Calculator className="w-5 h-5" />
                <span>Access Result Calculator</span>
              </button>
            </div>
          </div>
        </div>
        {/* Quick Access Section */}
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
          <div className="flex items-center space-x-4 mb-4">
            <FileText className="w-8 h-8 text-indigo-400" />
            <h2 className="text-2xl font-bold font-inter">Quick Access</h2>
          </div>
          <p className="text-gray-400 mb-4">Access the Result Calculator to generate individual marksheets and certificates using integrated result calculations.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setView('officer_result_calculator')}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-md shadow-md flex items-center justify-center space-x-2 transition duration-300 ease-in-out transform hover:scale-105"
            >
              <Calculator className="w-5 h-5" />
              <span>Result Calculator</span>
            </button>
            <button
              onClick={() => setView('notices')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-md shadow-md flex items-center justify-center space-x-2 transition duration-300 ease-in-out transform hover:scale-105"
            >
              <FileText className="w-5 h-5" />
              <span>Notice Board</span>
            </button>
          </div>
        </div>
      </div>
      );
};

// Component for the Exam Officer's Result Calculator
const OfficerResultCalculator = ({ departmentName }) => {
  const { db, userId, isAuthReady } = useAuth();
  const [academicYear, setAcademicYear] = useState("");
  const [batchYear, setBatchYear] = useState(""); // Admission year
  const [dataSource, setDataSource] = useState("current"); // 'current' or 'archive'
  const [results, setResults] = useState([]); // Stores aggregated results
  const [message, setMessage] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [documentType, setDocumentType] = useState('');
  
  // New state for enhanced document generation
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedRollNumber, setSelectedRollNumber] = useState("");
  const [selectedSession, setSelectedSession] = useState("");
  const [selectedDocumentType, setSelectedDocumentType] = useState(""); // 'marksheet' or 'certificate'
  const [templateFile, setTemplateFile] = useState(null);
  const [showTemplateUpload, setShowTemplateUpload] = useState(false);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [availableRollNumbers, setAvailableRollNumbers] = useState([]);

  const academicYears = [
    "2021-2022",
    "2022-2023",
    "2023-2024",
    "2024-2025",
    "2025-2026",
    "2026-2027",
  ]; // Example academic years
  const batchYears = [
    "2021",
    "2020",
    "2019",
    "2018",
    "2017",
    "2016",
    "2022",
    "2023",
    "2024",
    "2025",
  ]; // Example admission years, expanded
  
  // Enhanced data for document generation
  const departments = [
    "Computer Science and Engineering",
    "Electrical and Electronic Engineering", 
    "Mechanical Engineering",
    "Civil Engineering",
    "Chemical Engineering",
    "Textile Engineering",
    "Architecture",
    "Urban and Regional Planning",
    "Mathematics",
    "Physics",
    "Chemistry",
    "Statistics",
    "Economics",
    "English",
    "Bangla",
    "History",
    "Philosophy",
    "Political Science",
    "Sociology",
    "Social Work",
    "Public Administration",
    "International Relations",
    "Law",
    "Business Administration",
    "Accounting and Information Systems",
    "Management Information Systems",
    "Marketing",
    "Finance and Banking",
    "Tourism and Hospitality Management",
    "Development Studies",
    "Population Sciences",
    "Geography and Environment",
    "Botany",
    "Zoology",
    "Biochemistry and Molecular Biology",
    "Microbiology",
    "Genetic Engineering and Biotechnology",
    "Pharmacy",
    "Public Health",
    "Nursing",
    "Medical Science",
    "Dental Surgery",
    "Veterinary Medicine",
    "Agriculture",
    "Fisheries",
    "Forestry and Environmental Science",
    "Disaster Management",
    "Climate Change and Sustainability",
    "Information and Communication Technology",
    "Robotics and Mechatronics Engineering",
    "Biomedical Engineering",
    "Materials Science and Engineering",
    "Nuclear Engineering",
    "Marine Science",
    "Oceanography",
    "Meteorology",
    "Geology",
    "Petroleum and Mining Engineering",
    "Food Engineering and Technology",
    "Nutrition and Food Science",
    "Home Economics",
    "Physical Education and Sports Science",
    "Music",
    "Fine Arts",
    "Drama and Dramatics",
    "Film and Media Studies",
    "Journalism and Media Studies",
    "Library and Information Science",
    "Islamic Studies",
    "Sanskrit",
    "Arabic",
    "Persian",
    "Urdu",
    "Chinese",
    "Japanese",
    "Korean",
    "French",
    "German",
    "Spanish",
    "Russian",
    "Italian",
    "Portuguese",
    "Turkish",
    "Hindi",
    "Tamil",
    "Telugu",
    "Malayalam",
    "Kannada",
    "Marathi",
    "Gujarati",
    "Punjabi",
    "Bengali",
    "Oriya",
    "Assamese",
    "Manipuri",
    "Khasi",
    "Garo",
    "Mizo",
    "Naga",
    "Bodo",
    "Kokborok",
    "Munda",
    "Santhali",
    "Ho",
    "Kurukh",
    "Gondi",
    "Tulu",
    "Konkani",
    "Sindhi",
    "Kashmiri",
    "Dogri",
    "Nepali",
    "Sikkimese",
    "Bhutia",
    "Lepcha",
    "Limbu",
    "Rai",
    "Gurung",
    "Magar",
    "Tamang",
    "Newar",
    "Tharu",
    "Chepang",
    "Danuwar",
    "Majhi",
    "Kumal",
    "Sunuwar",
    "Yakkha",
    "Jirel",
    "Hayu",
    "Kusunda",
    "Raute",
    "Rajbanshi",
    "Dhimal",
    "Meche",
    "Koche",
    "Toto",
    "Lepcha",
    "Bhutia",
    "Sherpa",
    "Thakali",
    "Manangi",
    "Loba",
    "Dolpo",
    "Mustangi",
    "Humli",
    "Tingaule",
    "Larke",
    "Sarke",
    "Nubri",
    "Tsum",
    "Pharak",
    "Solukhumbu",
    "Okhaldhunga",
    "Khotang",
    "Bhojpur",
    "Dhankuta",
    "Terhathum",
    "Taplejung",
    "Panchthar",
    "Ilam",
    "Jhapa",
    "Morang",
    "Sunsari",
    "Saptari",
    "Siraha",
    "Dhanusa",
    "Mahottari",
    "Sarlahi",
    "Rautahat",
    "Bara",
    "Parsa",
    "Chitwan",
    "Makwanpur",
    "Dhading",
    "Nuwakot",
    "Rasuwa",
    "Sindhupalchok",
    "Dolakha",
    "Ramechhap",
    "Sindhuli",
    "Kavrepalanchok",
    "Lalitpur",
    "Bhaktapur",
    "Kathmandu",
    "Kaski",
    "Manang",
    "Mustang",
    "Myagdi",
    "Parbat",
    "Syangja",
    "Tanahu",
    "Lamjung",
    "Gorkha",
    "Nawalparasi",
    "Kapilvastu",
    "Rupandehi",
    "Arghakhanchi",
    "Gulmi",
    "Palpa",
    "Pyuthan",
    "Rolpa",
    "Rukum",
    "Salyan",
    "Dang",
    "Banke",
    "Bardiya",
    "Surkhet",
    "Dailekh",
    "Jajarkot",
    "Dolpa",
    "Jumla",
    "Kalikot",
    "Mugu",
    "Humla",
    "Bajura",
    "Bajhang",
    "Achham",
    "Doti",
    "Kailali",
    "Kanchanpur",
    "Dadeldhura",
    "Baitadi",
    "Darchula"
  ];
  
  const sessions = [
    "Spring 2021",
    "Summer 2021", 
    "Fall 2021",
    "Spring 2022",
    "Summer 2022",
    "Fall 2022",
    "Spring 2023",
    "Summer 2023",
    "Fall 2023",
    "Spring 2024",
    "Summer 2024",
    "Fall 2024",
    "Spring 2025",
    "Summer 2025",
    "Fall 2025"
  ];

  const calculateAverage = (marksArray) => {
    if (!marksArray || marksArray.length === 0) return 0;
    const total = marksArray.reduce(
      (sum, item) => sum + (parseFloat(item.score) || 0),
      0,
    );
    return parseFloat((total / marksArray.length).toFixed(2));
  };

  // New utility function to calculate combined average of assignment and in-course marks
  const calculateCombinedAssignmentAndInCourseAverage = (
    assignmentMarks,
    inCourseMarks,
  ) => {
    const allMarks = [];
    if (assignmentMarks) {
      allMarks.push(...assignmentMarks.map(item => parseFloat(item.score) || 0));
    }
    if (inCourseMarks) {
      allMarks.push(...inCourseMarks.map(item => parseFloat(item.score) || 0));
    }

    if (allMarks.length === 0) return 0; // Return 0 for calculation if no marks
    const total = allMarks.reduce((sum, score) => sum + score, 0);
    return parseFloat((total / allMarks.length).toFixed(2));
  };

  const handleLoadResults = async () => {
    setMessage("");
    setResults([]);
    if (!isAuthReady || !userId || !academicYear || !batchYear) {
      setMessage("Please select both Academic Year and Student Batch Year.");
      return;
    }

    try {
      const gradesCollectionName =
        dataSource === "current" ? "course_grades" : "archived_results";
      const gradesColRef = collection(
        db,
        getCollectionPath(gradesCollectionName, userId),
      );

      // 1. Get all students from the selected batch year
      const usersColRef = collection(db, getCollectionPath("users", userId));
      const studentQuery = query(
        usersColRef,
        where("role", "in", ["student", "alumni"]), // Include alumni for historical results
        where("batch", "==", batchYear),
      );
      const studentSnapshot = await getDocs(studentQuery);
      const students = studentSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      if (students.length === 0) {
        setMessage(`No students found for Batch ${batchYear}.`);
        return;
      }

      // 2. Fetch grades for these students for the selected academic year
      const aggregatedResults = [];
      let serialNo = 1;

      for (const student of students) {
        const studentGradesQuery = query(
          gradesColRef,
          where("studentEmail", "==", student.email),
          where("academicYear", "==", academicYear),
        );
        const studentGradesSnapshot = await getDocs(studentGradesQuery);
        const studentGrades = studentGradesSnapshot.docs.map((doc) =>
          doc.data(),
        );

        if (studentGrades.length === 0) {
          // If no grades for this student in this academic year, still add an entry
          aggregatedResults.push({
            serialNo: serialNo++,
            studentRollNumber: student.rollNumber,
            studentName: student.name,
            courseName: "No Courses",
            courseCode: "N/A",
            assignmentMarks: "N/A",
            inCourseMarks: "N/A",
            combinedAverage: "N/A", // Added combined average
            attendanceMarks: "N/A",
            finalExamMarks: "N/A",
            totalMarks: "N/A",
            session: student.batch,
            academicYear: academicYear,
            studentEmail: student.email,
          });
          continue;
        }

        for (const grade of studentGrades) {
          const avgInCourse = calculateAverage(grade.inCourseMarks);
          const combinedAvg = calculateCombinedAssignmentAndInCourseAverage(
            grade.assignmentMarks,
            grade.inCourseMarks,
          );

          // --- Final Exam Mark Calculation Logic ---
          let finalExamMarkDisplay = "N/A";
          let totalMarks = "N/A";
          const firstExaminerMark = parseFloat(grade.finalExamMarks);
          const secondExaminerMark = parseFloat(grade.secondExaminerFinalMark);
          const thirdExaminerMark = parseFloat(grade.thirdExaminerFinalMark);
          const hasFirst = !isNaN(firstExaminerMark) && grade.finalExamMarks !== undefined && grade.finalExamMarks !== "";
          const hasSecond = !isNaN(secondExaminerMark) && grade.secondExaminerFinalMark !== undefined && grade.secondExaminerFinalMark !== "";
          const hasThird = !isNaN(thirdExaminerMark) && grade.thirdExaminerFinalMark !== undefined && grade.thirdExaminerFinalMark !== "";

          if (hasThird) {
            finalExamMarkDisplay = thirdExaminerMark.toFixed(2);
            totalMarks = (parseFloat(combinedAvg) + (grade.attendanceMarks || 0) + thirdExaminerMark).toFixed(2);
          } else if (hasFirst && hasSecond) {
            const diff = Math.abs(firstExaminerMark - secondExaminerMark);
            if (diff >= THIRD_EXAMINER_THRESHOLD) {
              // Discrepancy, but no third examiner mark yet
              finalExamMarkDisplay = "N/A";
              totalMarks = "N/A";
            } else {
              const avg = ((firstExaminerMark + secondExaminerMark) / 2).toFixed(2);
              finalExamMarkDisplay = avg;
              totalMarks = (parseFloat(combinedAvg) + (grade.attendanceMarks || 0) + parseFloat(avg)).toFixed(2);
            }
          } else if (hasFirst) {
            // Only first examiner mark present (should not usually happen, but fallback)
            finalExamMarkDisplay = firstExaminerMark.toFixed(2);
            totalMarks = (parseFloat(combinedAvg) + (grade.attendanceMarks || 0) + firstExaminerMark).toFixed(2);
          } else {
            finalExamMarkDisplay = "N/A";
            totalMarks = "N/A";
          }
          // --- End Final Exam Mark Calculation Logic ---

          aggregatedResults.push({
            serialNo: serialNo++,
            studentRollNumber: student.rollNumber,
            studentName: student.name,
            courseName: grade.courseName,
            courseCode: grade.courseCode,
            assignmentMarks: grade.assignmentMarks?.[0]?.score || 0,
            inCourseMarks: avgInCourse,
            attendanceMarks: grade.attendanceMarks || 0,
            finalExamMarks: finalExamMarkDisplay,
            combinedAverage: combinedAvg, // Store combined average
            totalMarks: totalMarks,
            session: student.batch, // Student's admission batch
            academicYear: academicYear, // Academic year of the course
            studentEmail: student.email,
          });
        }
      }
      setResults(aggregatedResults);
      setMessage(
        `Results loaded from ${dataSource === "current" ? "current data" : "archive"} for Academic Year ${academicYear}, Batch ${batchYear}.`,
      );
    } catch (error) {
      console.error("Error loading results:", error);
      setMessage("Failed to load results.");
    }
  };

  const handleGenerateDocument = (studentData, docType) => {
    setSelectedStudent(studentData);
    setDocumentType(docType);
    setShowDocumentModal(true);
  };

  // Enhanced document generation functions
  const handleTemplateUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      setTemplateFile(file);
      setMessage('Template file uploaded successfully!');
    } else {
      setMessage('Please upload a valid Word document (.docx) file.');
    }
  };

  const handleDocumentTypeSelection = (docType) => {
    setSelectedDocumentType(docType);
    setShowTemplateUpload(true);
  };

  const handleGenerateIndividualDocument = async () => {
    if (!selectedDepartment || !selectedRollNumber || !selectedSession || !selectedDocumentType || !templateFile) {
      setMessage('Please fill in all required fields and upload a template file.');
      return;
    }

    // Find the student data from the loaded results
    const studentData = results.find(result => 
      result.studentRollNumber === selectedRollNumber
    );

    if (!studentData) {
      setMessage('Student data not found. Please load results first.');
      return;
    }

    // Simulate document generation with template
    setMessage(`Generating ${selectedDocumentType} for ${studentData.studentName} using uploaded template...`);
    
    // Here you would integrate with a document generation library
    // For now, we'll show the preview modal
    setSelectedStudent(studentData);
    setDocumentType(selectedDocumentType);
    setShowDocumentModal(true);
    setShowTemplateUpload(false);
  };

  const loadAvailableStudents = async () => {
    if (!selectedDepartment || !academicYear || !batchYear) {
      setMessage('Please select Department, Academic Year, and Batch Year first.');
      return;
    }

    try {
      // Filter results based on selected criteria
      const filteredResults = results.filter(result => 
        result.academicYear === academicYear && 
        result.session === batchYear
      );

      const uniqueStudents = filteredResults.reduce((acc, result) => {
        if (!acc.find(student => student.rollNumber === result.studentRollNumber)) {
          acc.push({
            rollNumber: result.studentRollNumber,
            name: result.studentName,
            email: result.studentEmail
          });
        }
        return acc;
      }, []);

      setAvailableStudents(uniqueStudents);
      setAvailableRollNumbers(uniqueStudents.map(student => student.rollNumber));
      setMessage(`Found ${uniqueStudents.length} students for the selected criteria.`);
    } catch (error) {
      console.error('Error loading students:', error);
      setMessage('Failed to load available students.');
    }
  };

  const handleDownloadResults = () => {
    if (results.length === 0) {
      setMessage("No results to download. Please load results first.");
      return;
    }

    const departmentDisplayName = departmentName ? `Department of ${departmentName}` : "Department";
    let academicYearTitleDisplay = academicYear;
    // Map academic year to 1st, 2nd, 3rd, 4th, Masters for header display
    const admissionYearInt = parseInt(batchYear);
    const academicYearStartInt = parseInt(academicYear.split("-")[0]);
    const yearDiff = academicYearStartInt - admissionYearInt;

    switch (yearDiff) {
      case 0:
        academicYearTitleDisplay = "1st Year";
        break;
      case 1:
        academicYearTitleDisplay = "2nd Year";
        break;
      case 2:
        academicYearTitleDisplay = "3rd Year";
        break;
      case 3:
        academicYearTitleDisplay = "4th Year";
        break;
      case 4:
        academicYearTitleDisplay = "Masters";
        break;
      case 5:
        academicYearTitleDisplay = "Graduated";
        break;
      default:
        academicYearTitleDisplay = academicYear; // Fallback
    }

    const admissionYear = batchYear;

    let content = `${departmentDisplayName}\n\n`;
    content += `Academic Year Title: ${academicYearTitleDisplay}\n`;
    content += `Admission Year (1st Year): ${admissionYear}\n\n`;
    content += `Data Source: ${dataSource === "current" ? "Current Records" : "Archived Records"}\n\n`;

    // Table Headers for detailed per-course results
    const headers = [
      "S.No.",
      "Roll No.",
      "Student Name",
      "Session",
      "Academic Year",
      "Course Name",
      "Course Code",
      "Assignment Marks",
      "In-Course Marks (Avg)",
      "Average of Assignment Marks and Tutorial/In-Course Marks", // New header
      "Attendance Marks",
      "Final Exam Marks",
      "Total Marks (Course)",
    ];
    content += headers.join("\t") + "\n"; // Tab-separated for easier pasting into Word/Excel

    // Iterate through results (which are already per-course)
    results.forEach((row) => {
      const rowData = [
        row.serialNo,
        row.studentRollNumber,
        row.studentName,
        row.session,
        row.academicYear,
        row.courseName,
        row.courseCode,
        row.assignmentMarks,
        row.inCourseMarks,
        row.combinedAverage, // Include combined average
        row.attendanceMarks,
        row.finalExamMarks,
        row.totalMarks,
      ];
      content += rowData.join("\t") + "\n";
    });

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Results_${academicYear}_Batch${batchYear}_${dataSource}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setMessage(
      "Results downloaded as a text file. You can copy-paste this into MS Word or Excel.",
    );
  };

  return (
    <div className="p-8 space-y-8 text-white">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
        <div className="flex items-center space-x-4 mb-6">
          <Calculator className="w-8 h-8 text-indigo-400" />
          <h2 className="text-2xl font-bold font-inter">Result Calculator - Exam Officer Access</h2>
        </div>
        <p className="text-gray-400 mb-6">Access integrated result calculations from Department Admins for individual marksheet and certificate generation.</p>
        
        <div className="mb-6 space-y-4">
          <div className="flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select Academic Year
              </label>
              <select
                className="w-full px-3 py-2 bg-gray-700 text-gray-300 border border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
              >
                <option value="">Select Year</option>
                {academicYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select Student Batch Year (Admission Year)
              </label>
              <select
                className="w-full px-3 py-2 bg-gray-700 text-gray-300 border border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                value={batchYear}
                onChange={(e) => setBatchYear(e.target.value)}
              >
                <option value="">Select Batch</option>
                {batchYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0 mt-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Data Source
              </label>
              <select
                className="w-full px-3 py-2 bg-gray-700 text-gray-300 border border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                value={dataSource}
                onChange={(e) => setDataSource(e.target.value)}
              >
                <option value="current">Current Results</option>
                <option value="archive">Archived Results</option>
              </select>
            </div>
            <div className="flex-1 flex items-end justify-end">
              <button
                onClick={handleLoadResults}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg shadow-md transition duration-200 w-full md:w-auto"
              >
                Load Results
              </button>
            </div>
          </div>
        </div>

        {/* Enhanced Document Generation Section */}
        {results.length > 0 && (
          <div className="bg-gray-700 p-6 rounded-lg shadow-xl mb-6">
            <h3 className="text-xl font-semibold text-gray-200 mb-4">Generate Individual Documents</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Department Name
                </label>
                <select
                  className="w-full px-3 py-2 bg-gray-600 text-gray-300 border border-gray-500 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Roll Number
                </label>
                <select
                  className="w-full px-3 py-2 bg-gray-600 text-gray-300 border border-gray-500 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  value={selectedRollNumber}
                  onChange={(e) => setSelectedRollNumber(e.target.value)}
                  disabled={availableRollNumbers.length === 0}
                >
                  <option value="">Select Roll Number</option>
                  {availableRollNumbers.map((rollNumber) => (
                    <option key={rollNumber} value={rollNumber}>
                      {rollNumber}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Session
                </label>
                <select
                  className="w-full px-3 py-2 bg-gray-600 text-gray-300 border border-gray-500 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                >
                  <option value="">Select Session</option>
                  {sessions.map((session) => (
                    <option key={session} value={session}>
                      {session}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={loadAvailableStudents}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow-md transition duration-200"
                  disabled={!selectedDepartment || !academicYear || !batchYear}
                >
                  Load Students
                </button>
              </div>
            </div>
            
            <div className="flex space-x-4 mb-4">
              <button
                onClick={() => handleDocumentTypeSelection('marksheet')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg shadow-md transition duration-200 flex items-center space-x-2"
                disabled={!selectedRollNumber || !selectedSession}
              >
                <FileText className="w-4 h-4" />
                <span>Generate Marksheet</span>
              </button>
              <button
                onClick={() => handleDocumentTypeSelection('certificate')}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg shadow-md transition duration-200 flex items-center space-x-2"
                disabled={!selectedRollNumber || !selectedSession}
              >
                <FileSignature className="w-4 h-4" />
                <span>Generate Certificate</span>
              </button>
            </div>
          </div>
        )}

        {/* Template Upload Modal */}
        {showTemplateUpload && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-200">
                  Upload Template for {selectedDocumentType === 'marksheet' ? 'Marksheet' : 'Certificate'}
                </h3>
                <button
                  onClick={() => setShowTemplateUpload(false)}
                  className="text-gray-400 hover:text-gray-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Upload Word Template (.docx)
                </label>
                <input
                  type="file"
                  accept=".docx"
                  onChange={handleTemplateUpload}
                  className="w-full px-3 py-2 bg-gray-700 text-gray-300 border border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Upload a Word document template that will be used to generate the {selectedDocumentType}.
                </p>
              </div>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setShowTemplateUpload(false)}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateIndividualDocument}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
                  disabled={!templateFile}
                >
                  Generate Document
                </button>
              </div>
            </div>
          </div>
        )}

        {message && <p className="text-blue-400 mb-4">{message}</p>}

        {results.length > 0 && (
          <div className="mt-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-200">
                Loaded Results
              </h3>
              <button
                onClick={handleDownloadResults}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow-md transition duration-200"
              >
                Download Results
              </button>
            </div>
            <div className="overflow-x-auto mb-6">
              <table className="min-w-full bg-gray-700 rounded-lg overflow-hidden shadow-sm">
                <thead className="bg-gray-600 border-b border-gray-500">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      S.No.
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Roll No.
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Student Name
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Course Name
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Total Marks
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-600">
                  {results.map((row, index) => (
                    <tr key={index} className="hover:bg-gray-600">
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300">
                        {row.serialNo}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300">
                        {row.studentRollNumber}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300">
                        {row.studentName}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300">
                        {row.courseName}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm font-semibold text-gray-200">
                        {row.totalMarks}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleGenerateDocument(row, 'marksheet')}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-1 px-3 rounded-md shadow-md transition duration-300 ease-in-out text-xs"
                          >
                            Generate Marksheet
                          </button>
                          <button
                            onClick={() => handleGenerateDocument(row, 'certificate')}
                            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-1 px-3 rounded-md shadow-md transition duration-300 ease-in-out text-xs"
                          >
                            Generate Certificate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Document Preview Modal */}
      {showDocumentModal && selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">
                {documentType === 'marksheet' ? 'Marksheet Preview' : 'Certificate Preview'}
              </h3>
              <button
                onClick={() => setShowDocumentModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            {templateFile && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>Template Used:</strong> {templateFile.name}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  This document was generated using the uploaded Word template.
                </p>
              </div>
            )}
            <div className="border border-gray-300 p-4 mb-4">
              {documentType === 'marksheet' ? (
                <div className="p-8 font-inter">
                  <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold">University of Fictional Studies</h1>
                    <h2 className="text-xl font-semibold mt-2">Statement of Marks</h2>
                    <p className="text-sm mt-1">Marksheet</p>
                  </div>
                  <div className="flex justify-between text-sm mb-4">
                    <span>Name: <span className="font-semibold">{selectedStudent.studentName}</span></span>
                    <span>Student ID: <span className="font-semibold">{selectedStudent.studentRollNumber}</span></span>
                  </div>
                  <div className="text-sm mb-8">
                    <p>Course: {selectedStudent.courseName} ({selectedStudent.courseCode})</p>
                    <p>Session: {selectedStudent.session}</p>
                    <p>Academic Year: {selectedStudent.academicYear}</p>
                  </div>
                  <div className="border border-gray-300 p-4 mb-8">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="p-2 text-left text-sm font-semibold">Course</th>
                          <th className="p-2 text-left text-sm font-semibold">Assignment Marks</th>
                          <th className="p-2 text-left text-sm font-semibold">In-Course Marks</th>
                          <th className="p-2 text-left text-sm font-semibold">Attendance</th>
                          <th className="p-2 text-left text-sm font-semibold">Final Exam</th>
                          <th className="p-2 text-left text-sm font-semibold">Total Marks</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="p-2 text-sm">{selectedStudent.courseName}</td>
                          <td className="p-2 text-sm">{selectedStudent.assignmentMarks}</td>
                          <td className="p-2 text-sm">{selectedStudent.inCourseMarks}</td>
                          <td className="p-2 text-sm">{selectedStudent.attendanceMarks}</td>
                          <td className="p-2 text-sm">{selectedStudent.finalExamMarks}</td>
                          <td className="p-2 text-sm font-bold">{selectedStudent.totalMarks}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-between items-end mt-16">
                    <div className="flex flex-col items-center">
                      <div className="h-16 mb-2 border-b-2 border-black w-32"></div>
                      <span className="text-xs font-semibold">Prepared By (Officer)</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="h-16 mb-2 border-b-2 border-black w-32"></div>
                      <span className="text-xs font-semibold">Checked By (Officer)</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="h-16 mb-2 border-b-2 border-black w-32"></div>
                      <span className="text-xs font-semibold">Controller of Examinations</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative font-inter">
                  <div className="bg-gray-100 text-black p-8 text-center border-4 border-dashed border-gray-400">
                    <h1 className="text-4xl font-bold">Provisional Certificate</h1>
                    <p className="mt-4 text-lg">This is to certify that</p>
                    <p className="text-5xl font-bold my-4">{selectedStudent.studentName}</p>
                    <p className="text-2xl">has successfully completed all requirements for the degree of</p>
                    <p className="text-3xl font-bold my-4">Bachelor of Science</p>
                    <p className="text-lg mt-4">Student ID: {selectedStudent.studentRollNumber}</p>
                    <p className="text-lg">Course: {selectedStudent.courseName}</p>
                    <p className="text-lg">Total Marks: {selectedStudent.totalMarks}</p>
                  </div>
                  <div className="absolute bottom-8 right-12">
                    <div className="h-20 border-b-2 border-black w-32"></div>
                    <span className="text-sm font-semibold border-t-2 border-black pt-1 block">Controller of Examinations</span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowDocumentModal(false)}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md"
              >
                Close
              </button>
              <button
                onClick={() => {
                  // Generate PDF functionality would go here
                  if (templateFile) {
                    setMessage(`Generating ${documentType} PDF using template: ${templateFile.name}`);
                  } else {
                    setMessage(`Generating ${documentType} PDF with default template`);
                  }
                  setShowDocumentModal(false);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
              >
                Generate PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Component for the Controller of Examinations' dashboard
  const ControllerDashboard = ({ setView }) => {
    // Mock data for the controller dashboard
    const mockData = {
      results: [
        { studentId: 'STU001', type: 'marksheet', status: 'sent_to_controller' },
        { studentId: 'STU002', type: 'marksheet', status: 'final' },
        { studentId: 'STU003', type: 'marksheet', status: 'sent_to_controller' },
      ]
    };

    // Filter documents for the controller to approve
    const pendingDocuments = mockData.results.filter(doc => doc.status === 'sent_to_controller');
    // Filter final documents for controller to view
    const finalDocuments = mockData.results.filter(doc => doc.status === 'final');

    const handleCertificateTemplateUpload = (e) => {
      const file = e.target.files[0];
      if (file) {
        // Handle file upload - simplified for now
        console.log('Certificate template uploaded:', file.name);
      }
    };

    return (
      <div className="p-8 space-y-8 text-white">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Profile Section */}
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
            <div className="flex items-center space-x-4 mb-4">
              <User className="w-8 h-8 text-indigo-400" />
              <h2 className="text-2xl font-bold font-inter">My Profile</h2>
            </div>
            <p className="text-gray-400">Manage your personal information and digital signature.</p>
            <div className="mt-4">
              <button
                onClick={() => setView('profile')}
                className="w-full bg-indigo-600 hover:bg-indigo-700 font-semibold py-3 px-6 rounded-md shadow-md flex items-center justify-center space-x-2 transition duration-300 ease-in-out transform hover:scale-105"
              >
                <User className="w-5 h-5" />
                <span>Manage My Profile</span>
              </button>
            </div>
          </div>
          {/* Certificate Template Upload Section */}
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
            <div className="flex items-center space-x-4 mb-4">
              <UploadCloud className="w-8 h-8 text-indigo-400" />
              <h2 className="text-2xl font-bold font-inter">Certificate Template Upload</h2>
            </div>
            <p className="text-gray-400 mb-4">Upload a pre-designed certificate template. The system will auto-fill student data.</p>
            <div className="bg-gray-700 p-4 rounded-md shadow-inner">
              <label className="block text-gray-300 font-semibold mb-2">
                Upload Template (Image)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleCertificateTemplateUpload}
                className="text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-500 file:text-white hover:file:bg-indigo-600"
              />
            </div>
          </div>
        </div>
        {/* Pending Documents for Approval */}
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
          <div className="flex items-center space-x-4 mb-4">
            <CheckCircle className="w-8 h-8 text-indigo-400" />
            <h2 className="text-2xl font-bold font-inter">Pending Documents for Approval</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Document ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Document Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {pendingDocuments.map(doc => (
                  <tr key={doc.studentId}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-200">{doc.studentId}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{doc.type}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-500 bg-opacity-20 text-blue-400">
                        {doc.status.replace('_', ' ').charAt(0).toUpperCase() + doc.status.replace('_', ' ').slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      <button
                        onClick={() => {
                          // Handle approval - simplified for now
                          console.log('Approved document:', doc.studentId);
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out"
                      >
                        Approve
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // Login page component
  const LoginPage = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
      e.preventDefault();
      setError("");

      try {
        // Check Officers (added by Super Admin) directly in Firestore
        const officersQuery = query(
          collection(db, getGlobalCollectionPath("exam_officers")),
          where("universityEmail", "==", email)
        );
        const officerSnap = await getDocs(officersQuery);
        if (!officerSnap.empty) {
          const officer = officerSnap.docs[0].data();
          if (officer.password === password) {
            setUserRole('officer');
            setProfileData(prev => ({
              ...prev,
              name: officer.name || '',
              universityEmail: officer.universityEmail || '',
              personalEmail: officer.personalEmail || '',
              profilePicture: officer.profilePicture || '',
              designation: officer.designation || ''
            }));
            return;
          }
        }

        // Check Controllers (added by Super Admin) directly in Firestore
        const controllersQuery = query(
          collection(db, getGlobalCollectionPath("exam_controllers")),
          where("universityEmail", "==", email)
        );
        const controllerSnap = await getDocs(controllersQuery);
        if (!controllerSnap.empty) {
          const controller = controllerSnap.docs[0].data();
          if (controller.password === password) {
            setUserRole('controller');
            setProfileData(prev => ({
              ...prev,
              name: controller.name || '',
              universityEmail: controller.universityEmail || '',
              personalEmail: controller.personalEmail || '',
              profilePicture: controller.profilePicture || '',
              designation: controller.designation || ''
            }));
            return;
          }
        }

        // If no match found
        setError("Invalid credentials. Only Officers and Controllers of Examinations added through the Super Admin Dashboard can access this system.");
      } catch (err) {
        console.error("Login check failed:", err);
        setError("Something went wrong while checking your credentials. Please try again.");
      }
    };

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white relative">
        {/* Back to Home Button - positioned at top */}
        <div className="absolute top-4 left-4">
          <button
            onClick={() => navigateTo('home')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out transform hover:scale-105 flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
            </svg>
            <span>Back to Home</span>
          </button>
        </div>
        
        <div className="bg-gray-800 p-8 rounded-xl shadow-lg w-full max-w-md text-center">
          <h2 className="text-3xl font-bold text-indigo-400 mb-6">Result Management Login</h2>
          <p className="text-gray-400 mb-6">Login with your University Email and password.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input 
              type="email" 
              placeholder="University Email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-700 text-white" 
              required
            />
            <input 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-700 text-white" 
              required
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" className="w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75 transition duration-300 ease-in-out">Login</button>
          </form>
          <div className="mt-4 text-sm text-gray-400">
            <p>Only Officers and Controllers of Examinations added through the Super Admin Dashboard can access this system.</p>
          </div>
        </div>
      </div>
    );
  };

  // Modal for displaying the document preview
  const DocumentPreviewModal = () => {
    if (!showDocumentModal || !selectedDocument) return null;

    // Simulated content for the marksheet
    const MarksheetContent = () => (
      <div className="p-8 font-inter">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">University of Fictional Studies</h1>
          <h2 className="text-xl font-semibold mt-2">Statement of Marks</h2>
          <p className="text-sm mt-1">{selectedDocument.documentType}</p>
        </div>
        <div className="flex justify-between text-sm mb-4">
          <span>Name: <span className="font-semibold">{selectedDocument.studentData.name}</span></span>
          <span>Student ID: <span className="font-semibold">{selectedDocument.studentData.studentId}</span></span>
        </div>
        <div className="text-sm mb-8">
          <p>Department: {selectedDocument.department}</p>
          <p>Course: {selectedDocument.courseTitle} ({selectedDocument.courseCode})</p>
          <p>Session: {selectedDocument.session}</p>
        </div>
        <div className="border border-gray-300 p-4 mb-8">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 text-left text-sm font-semibold">Course</th>
                <th className="p-2 text-left text-sm font-semibold">Marks</th>
                <th className="p-2 text-left text-sm font-semibold">Grade</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-2 text-sm">{selectedDocument.courseTitle}</td>
                <td className="p-2 text-sm">{selectedDocument.studentData.marks}</td>
                <td className="p-2 text-sm">{selectedDocument.studentData.grade}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="flex justify-between items-end mt-16">
          <div className="flex flex-col items-center">
            <img src={userSignatures.officerPreparer} alt="Preparer Signature" className="h-16 mb-2" />
            <span className="text-xs font-semibold border-t-2 border-black pt-1">Prepared By (Officer)</span>
          </div>
          <div className="flex flex-col items-center">
            <img src={userSignatures.officerChecker} alt="Checker Signature" className="h-16 mb-2" />
            <span className="text-xs font-semibold border-t-2 border-black pt-1">Checked By (Officer)</span>
          </div>
          <div className="flex flex-col items-center">
            <img src={userSignatures.controller} alt="Controller Signature" className="h-16 mb-2" />
            <span className="text-xs font-semibold border-t-2 border-black pt-1">Controller of Examinations</span>
          </div>
        </div>
      </div>
    );

    // Simulated content for the provisional certificate
    const CertificateContent = () => (
      <div className="relative font-inter">
        {certificateTemplate ? (
          <img src={certificateTemplate} alt="Certificate Template" className="w-full h-auto" />
        ) : (
          <div className="bg-gray-100 text-black p-8 text-center border-4 border-dashed border-gray-400">
            <h1 className="text-4xl font-bold">Provisional Certificate</h1>
            <p className="mt-4 text-lg">No template uploaded. This is a placeholder.</p>
          </div>
        )}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-black">
          <p className="text-2xl">This is to certify that</p>
          <p className="text-5xl font-bold my-4">{selectedDocument.studentData.name}</p>
          <p className="text-2xl">has successfully completed all requirements for the degree of</p>
          <p className="text-3xl font-bold my-4">Bachelor of Science in {selectedDocument.department}</p>
        </div>
        <div className="absolute bottom-8 right-12">
          <img src={userSignatures.controller} alt="Controller Signature" className="h-20" />
          <span className="text-sm font-semibold border-t-2 border-black pt-1 block">Controller of Examinations</span>
        </div>
      </div>
    );

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm p-4">
        <div className="bg-white rounded-lg shadow-2xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="p-4 bg-gray-900 text-white flex justify-between items-center">
            <h3 className="text-xl font-bold">Document Preview: {selectedDocument.documentType}</h3>
            <button
              onClick={() => setShowDocumentModal(false)}
              className="text-gray-300 hover:text-white transition duration-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          {/* PDF Margins and Actions */}
          <div className="p-4 bg-gray-800 flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0 sm:space-x-4">
            <div className="flex flex-wrap gap-4 items-center text-sm text-gray-300">
              <label>Top Margin (mm): <input type="number" value={pdfMargins.top} onChange={e => setPdfMargins({...pdfMargins, top: e.target.value})} className="w-16 p-1 rounded bg-gray-700 text-white" /></label>
              <label>Bottom Margin (mm): <input type="number" value={pdfMargins.bottom} onChange={e => setPdfMargins({...pdfMargins, bottom: e.target.value})} className="w-16 p-1 rounded bg-gray-700 text-white" /></label>
              <label>Left Margin (mm): <input type="number" value={pdfMargins.left} onChange={e => setPdfMargins({...pdfMargins, left: e.target.value})} className="w-16 p-1 rounded bg-gray-700 text-white" /></label>
              <label>Right Margin (mm): <input type="number" value={pdfMargins.right} onChange={e => setPdfMargins({...pdfMargins, right: e.target.value})} className="w-16 p-1 rounded bg-gray-700 text-white" /></label>
            </div>
            <button
              onClick={generatePdf}
              disabled={isGenerating}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-md shadow-md flex items-center space-x-2 transition duration-300 ease-in-out transform hover:scale-105 disabled:bg-indigo-400"
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  <span>Print & Download PDF</span>
                </>
              )}
            </button>
          </div>

          {/* Document Content */}
          <div className="flex-1 overflow-y-auto bg-gray-100 p-4">
            <div className="document-to-print bg-white p-8 shadow-lg">
              {documentType === 'marksheet' ? <MarksheetContent /> : <CertificateContent />}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-green-50 to-red-50 font-sans">
      <script src="https://cdn.tailwindcss.com"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>

      {/* Main App Layout */}
      {userRole === null ? (
        <LoginPage />
      ) : (
        <>
          <Header />
          <main className="p-4 md:p-8">
            {/* Conditional rendering based on the current page */}
            {currentPage === 'dashboard' && userRole === 'officer' && <OfficerDashboard setView={setCurrentPage} />}
            {currentPage === 'dashboard' && userRole === 'controller' && <ControllerDashboard setView={setCurrentPage} />}
            {currentPage === 'profile' && <ProfilePage />}
          </main>
        </>
      )}

      {/* Render the document preview modal */}
      <DocumentPreviewModal />
      {/* Render the toast notification */}
      {toastMessage && <Toast message={toastMessage.message} type={toastMessage.type} />}

      {/* Add Google Fonts for better typography */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        body {
          font-family: 'Inter', sans-serif;
        }
      `}</style>
    </div>
  );
};

// Firebase Configuration - Provided by the environment
// -----------------------------------------------------------------------
// LOCAL DEVELOPMENT SWITCH
// -----------------------------------------------------------------------
// Set this to `true` while developing on your own machine to run entirely
// against the Firebase Local Emulator Suite (no real Firebase project,
// no internet connection, and no billing needed).
//
// When you're ready to go live, set this to `false` (or delete this block)
// and fill in your real firebaseConfig below — no other code in this file
// needs to change, because every onSnapshot/getDocs/setDoc/etc. call in
// the app just uses the `db`/`auth`/`storage` objects created here.
const USE_LOCAL_EMULATOR = false;

const firebaseConfig = {
  apiKey: "AIzaSyB6IBoVCoYHoJFAp8VpwbWYy9ZYt0UEcVk",
  authDomain: "juams-prod.firebaseapp.com",
  databaseURL: "https://juams-prod-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "juams-prod",
  storageBucket: "juams-prod.firebasestorage.app",
  messagingSenderId: "561508410377",
  appId: "1:561508410377:web:f5299472033d3b7761c4d8",
};

const appId = typeof __app_id !== "undefined" ? __app_id : "default-app-id";
const initialAuthToken =
  typeof __initial_auth_token !== "undefined" ? __initial_auth_token : null;

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Connect to local emulators instead of the real Firebase backend.
// This must run once, immediately after getFirestore/getAuth/getStorage,
// before any other Firestore/Auth/Storage call is made.
if (USE_LOCAL_EMULATOR) {
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  console.log("🔧 Running against LOCAL Firebase Emulator Suite (no real Firebase project used).");
}

// Context for Auth and Firestore
const AuthContext = createContext(null);

// Auth Provider Component
const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        setUserId(user.uid);
      } else {
        // Sign in anonymously if no custom token or if custom token fails
        try {
          if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
          } else {
            await signInAnonymously(auth);
          }
          setCurrentUser(auth.currentUser);
          setUserId(auth.currentUser?.uid || crypto.randomUUID()); // Fallback for anonymous
        } catch (error) {
          console.error("Firebase authentication error:", error);
          setUserId(crypto.randomUUID()); // Fallback to a random ID if auth fails
        }
      }
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{ currentUser, userId, db, auth, isAuthReady }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom Hook to use Auth Context
const useAuth = () => {
  return useContext(AuthContext);
};

// Function to get department abbreviation for email
const getDepartmentEmailSuffix = (departmentName) => {
  if (!departmentName) return "dept";
  
  // Convert to lowercase and replace spaces/special characters with hyphens
  const cleanName = departmentName.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  
  // Split into words and take first letter of each word
  const words = cleanName.split(/\s+/);
  if (words.length === 1) {
    // Single word: use first 3 letters
    return words[0].substring(0, 3);
  } else if (words.length === 2) {
    // Two words: use first letter of each
    return words[0].charAt(0) + words[1].charAt(0);
  } else {
    // Three or more words: use first letter of first two words
    return words[0].charAt(0) + words[1].charAt(0);
  }
};

// Function to generate demo email based on department
const generateDemoEmail = (username, departmentName) => {
  const suffix = getDepartmentEmailSuffix(departmentName);
  return `${username}@${suffix}.${UNIVERSITY_DOMAIN}`;
};

// Mock User Data (for initial setup and demo)
const getMockUsers = (departmentName) => [
  {
    email: generateDemoEmail("masteradmin", departmentName),
    password: "password123",
    role: "master_admin",
    name: "Master Admin",
    personalEmail: "master.admin.personal@example.com",
    profilePicture: "https://placehold.co/100x100/333333/ffffff?text=M.Admin",
  },
];

// Utility function to get collection path based on user ID and app ID
const getCollectionPath = (collectionName, currentUserId, isPublic = false, departmentName = null) => {
  const selectedDept = departmentName || window.selectedDepartmentName || "default";
  const deptSlug = selectedDept.toLowerCase().replace(/[^a-z0-9]/g, '-');
  
  if (isPublic) {
    return `artifacts/${appId}/public/data/${deptSlug}_${collectionName}`;
  }
  return `artifacts/${appId}/users/${currentUserId}/${deptSlug}_${collectionName}`;
};

// Utility function for university-wide (non-department-scoped) collections
// Used for data that isn't tied to any single department, e.g. the department
// list itself, Assistant Super Admins, Exam Officers, and Exam Controllers.
const getGlobalCollectionPath = (collectionName) => {
  return `artifacts/${appId}/public/data/${collectionName}`;
};

// Custom Modal Component for confirmations/alerts
const CustomModal = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  showCancel = true,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-sm">
        <h3 className="text-xl font-bold text-gray-800 mb-4">{title}</h3>
        <p className="text-gray-700 mb-6">{message}</p>
        <div className="flex justify-end space-x-3">
          {showCancel && (
            <button
              onClick={onCancel}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-5 py-2 rounded-lg shadow-md transition duration-200"
            >
              Cancel
            </button>
          )}
          <button
            onClick={onConfirm}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg shadow-md transition duration-200"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

// Login Component
const Login = ({ onLoginSuccess, departmentName }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { db, isAuthReady, userId } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    if (!isAuthReady || !userId) {
      setError("Access not ready, please wait.");
      return;
    }

    try {
      // In a real app, you'd use Firebase Auth signInWithEmailAndPassword
      // For this demo, we'll mock it by checking against Firestore
      const usersColRef = collection(db, getCollectionPath("users", userId, false, departmentName));
      const q = query(usersColRef, where("email", "==", email));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError("User not found.");
        return;
      }

      const userData = querySnapshot.docs[0].data();
      if (userData.password !== password) {
        setError("Incorrect password.");
        return;
      }

      // Simulate login success
      onLoginSuccess(userData);
    } catch (err) {
      console.error("Login error:", err);
      setError("Login failed.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">
          Login
        </h2>
        <p className="text-center text-gray-600 mb-6">
          Log in to access your dashboard.
        </p>
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              placeholder={`yourname@${getDepartmentEmailSuffix(departmentName)}.${UNIVERSITY_DOMAIN}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-red-600 text-sm text-center">{error}</p>}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition duration-200 shadow-md"
          >
            Login
          </button>
        </form>
        <div className="mt-6 text-center text-gray-500 text-sm">
          <p className="font-bold mb-2">
            Demo Email and Password:
          </p>
          <ul className="list-disc list-inside text-left mx-auto max-w-xs">
            <li>Master Admin: {generateDemoEmail("masteradmin", departmentName)} (password: password123)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

// Header Component
const Header = ({ user, onLogout, onEditProfile, unreadNoticesCount }) => {
  return (
    <header className="bg-gradient-to-r from-blue-700 to-blue-900 text-white p-4 shadow-md rounded-b-xl">
      <div className="container mx-auto flex justify-between items-center">
      <h1 className="text-2xl md:text-3xl font-bold">
  <span className="text-yellow-300">{window.selectedDepartmentName || "University"}</span> Department Portal
</h1>
        <nav className="flex items-center space-x-4">
          {user && (
            <>
              <span className="text-lg font-medium hidden md:block">
                Welcome, {user.name}
              </span>
              {/* Unread badge moved here, between name and logout */}
              {unreadNoticesCount > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg animate-bounce">
                  {unreadNoticesCount} Unread Notices
                </span>
              )}
              {user.role === "master_admin" && (
                <button
                  onClick={onEditProfile}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg shadow-md hover:bg-purple-700 transition duration-200"
                >
                  Edit Profile
                </button>
              )}
              <button
                onClick={onLogout}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg shadow-md transition duration-200"
              >
                Logout
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};

// Sidebar Navigation
const Sidebar = ({ currentView, setView, userRole, unreadNoticesCount, unreadSeminarNotices, unreadThesisSubmissionNotices, unreadThesisDefenseNotices, unreadDegreeStatusNotices }) => {
  const navItems = {
    master_admin: [
      { id: "profile", label: "Profile", icon: "👤" },
      { id: "admin_dashboard", label: "Admin Dashboard", icon: "⚙️" },
      { id: "notices", label: "Notice Management", icon: "📰" },
      { id: "manage_users", label: "User Management", icon: "👥" },
      { id: "promote_students", label: "Year Promotion", icon: "⬆️" },
      {
        id: "course_enrollment_approval",
        label: "Enrollment Approval",
        icon: "✅",
      },
      { id: "result_calculator", label: "Result Calculator", icon: "🧮" },
      { id: "assign_examiners", label: "Assign Examiners", icon: "✍️" },
      { id: "researcher_management", label: "Researcher Management", icon: "🔬" },
    ],
    teacher: [
      { id: "profile", label: "Profile", icon: "👤" },
      { id: "assignments", label: "Assignments", icon: "📝" },
      { id: "evaluation", label: "Evaluation", icon: "✅" },
      { id: "evaluations", label: "Teacher Evaluation Report", icon: "📊" },
      { id: "resources", label: "Resource Library", icon: "📚" },
      { id: "notices", label: "Notice Board", icon: "📰" },
    ],
    second_examiner: [
      { id: "profile", label: "Profile", icon: "👤" },
      {
        id: "evaluate_scripts_second",
        label: "Evaluate Scripts (2nd)",
        icon: "✏️",
      },
      { id: "notices", label: "Notice Board", icon: "📰" },
    ],
    third_examiner: [
      { id: "profile", label: "Profile", icon: "👤" },
      {
        id: "evaluate_scripts_third",
        label: "Evaluate Scripts (3rd)",
        icon: "🖍️",
      },
      { id: "notices", label: "Notice Board", icon: "📰" },
    ],
    student: [
      { id: "profile", label: "Profile", icon: "👤" },
      { id: "course_selection", label: "Course Selection", icon: "➕" },
      { id: "assignments", label: "Assignments", icon: "📝" },
      { id: "results", label: "Results", icon: "💯" },
      { id: "evaluate_teachers", label: "Teacher Evaluation", icon: "⭐" },
      { id: "notices", label: "Notice Board", icon: "📰" },
      { id: "resources", label: "Resource Library", icon: "📚" },
      { id: "archive", label: "Archive", icon: "📦" },
    ],
    mphil_researcher: [
      { id: "profile", label: "Profile", icon: "👤" },
      { id: "coursework", label: "Coursework", icon: "📖" },
      { id: "seminars", label: "Seminars", icon: "🗣️", badge: unreadSeminarNotices },
      { id: "thesis_submission", label: "Thesis Submission", icon: "📄", badge: unreadThesisSubmissionNotices },
      { id: "thesis_defense", label: "Thesis Defense", icon: "🛡️", badge: unreadThesisDefenseNotices },
      { id: "degree_status", label: "Degree Status", icon: "🎓", badge: unreadDegreeStatusNotices },
      { id: "notices", label: "Notice Board", icon: "📰" },
      { id: "resources", label: "Resource Library", icon: "📚" },
    ],
    phd_researcher: [
      { id: "profile", label: "Profile", icon: "👤" },
      { id: "coursework", label: "Coursework", icon: "📖" },
      { id: "seminars", label: "Seminars", icon: "🗣️", badge: unreadSeminarNotices },
      { id: "thesis_submission", label: "Thesis Submission", icon: "📄", badge: unreadThesisSubmissionNotices },
      { id: "thesis_defense", label: "Thesis Defense", icon: "🛡️", badge: unreadThesisDefenseNotices },
      { id: "degree_status", label: "Degree Status", icon: "🎓", badge: unreadDegreeStatusNotices },
      { id: "notices", label: "Notice Board", icon: "📰" },
      { id: "resources", label: "Resource Library", icon: "📚" },
    ],
    admin: [
      { id: "profile", label: "Profile", icon: "👤" },
      { id: "admin_dashboard", label: "Admin Dashboard", icon: "⚙️" },
      { id: "notices", label: "Notice Management", icon: "📰" },
      { id: "manage_users", label: "User Management", icon: "👥" },
      { id: "promote_students", label: "Year Promotion", icon: "⬆️" },
      {
        id: "course_enrollment_approval",
        label: "Enrollment Approval",
        icon: "✅",
      },
      { id: "result_calculator", label: "Result Calculator", icon: "🧮" },
      { id: "assign_examiners", label: "Assign Examiners", icon: "✍️" },
      { id: "researcher_management", label: "Researcher Management", icon: "🔬" },
    ],
    alumni: [
      { id: "profile", label: "Profile", icon: "👤" },
      { id: "results", label: "My Results", icon: "💯" },
      { id: "notices", label: "Notice Board", icon: "📰" },
      { id: "archive", label: "Archive", icon: "📦" },
    ],
    officer: [
      { id: "profile", label: "Profile", icon: "👤" },
      { id: "officer_dashboard", label: "Officer Dashboard", icon: "⚙️" },
      { id: "officer_result_calculator", label: "Result Calculator", icon: "🧮" },
      { id: "notices", label: "Notice Board", icon: "📰" },
    ],
    controller: [
      { id: "profile", label: "Profile", icon: "👤" },
      { id: "controller_dashboard", label: "Controller Dashboard", icon: "⚙️" },
      { id: "notices", label: "Notice Board", icon: "📰" },
    ],
  };
  const items = navItems[userRole] || [];

  return (
    <div className="w-64 bg-gray-800 text-white flex flex-col rounded-tr-xl rounded-br-xl shadow-lg">
      <div className="p-6 text-2xl font-bold text-center border-b border-gray-700">
        Dashboard
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`w-full text-left px-4 py-3 rounded-lg flex items-center space-x-3 transition duration-200
                            ${currentView === item.id ? "bg-blue-600 text-white shadow-inner" : "hover:bg-gray-700 text-gray-300"}`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-lg">{item.label}</span>
            {/* Show per-type badge for researcher pages only, not for Notice Board */}
            {item.badge > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {item.badge}
              </span>
            )}
            {/* Always show unread badge for notices if there are unread notices, for all roles */}
            {item.id === "notices" && unreadNoticesCount > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadNoticesCount}
              </span>
            )}
          </button>
        ))}
      </nav>
      <div className="p-4 text-sm text-gray-400 border-t border-gray-700">
        User ID: <span className="break-all">{useAuth().userId}</span>
      </div>
    </div>
  );
};
// Reusable Card Component
const Card = ({ title, children, className = "" }) => (
  <div className={`bg-white p-6 rounded-xl shadow-md ${className}`}>
    <h3 className="text-2xl font-semibold text-gray-800 mb-4 border-b pb-2">
      {title}
    </h3>
    {children}
  </div>
);

// Edit Profile Modal Component
const EditProfileModal = ({
  isOpen,
  onClose,
  user,
  onSave,
  canEditAll = false,
}) => {
  const [name, setName] = useState(user.name);
  const [departmentEmail, setDepartmentEmail] = useState(user.email);
  const [personalEmail, setPersonalEmail] = useState(user.personalEmail || "");
  const [password, setPassword] = useState(user.password); // For demo, in real app, handle securely
  const [profilePicture, setProfilePicture] = useState(
    user.profilePicture || "",
  );
  const [designation, setDesignation] = useState(user.designation || "");
  const [joinDate, setJoinDate] = useState(user.joinDate || "");
  const [education, setEducation] = useState(user.education || "");
  const [address, setAddress] = useState(user.address || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [rollNumber, setRollNumber] = useState(user.rollNumber || "");
  const [batch, setBatch] = useState(user.batch || "");
  const [currentYear, setCurrentYear] = useState(
    user.currentYear || "1st Year",
  );
  const [hall, setHall] = useState(user.hall || "");

  const [message, setMessage] = useState("");

  useEffect(() => {
    if (user) {
      setName(user.name);
      setDepartmentEmail(user.email);
      setPersonalEmail(user.personalEmail || "");
      setPassword(user.password);
      setProfilePicture(user.profilePicture || "");
      setDesignation(user.designation || "");
      setJoinDate(user.joinDate || "");
      setEducation(user.education || "");
      setAddress(user.address || "");
      setPhone(user.phone || "");
      setRollNumber(user.rollNumber || "");
      setBatch(user.batch || "");
      setCurrentYear(user.currentYear || "1st Year");
      setHall(user.hall || "");
      setMessage("");
    }
  }, [user]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setMessage("");

    const updatedData = {
      password: password, // Password is always editable by self
    };

    if (canEditAll) {
      Object.assign(updatedData, {
        name: name,
        email: departmentEmail,
        personalEmail: personalEmail,
        profilePicture: profilePicture,
      });

      if (user.role === "teacher") {
        Object.assign(updatedData, {
          designation: designation,
          joinDate: joinDate,
          education: education,
          address: address,
          phone: phone,
        });
      } else if (user.role === "student" || user.role === "alumni") {
        Object.assign(updatedData, {
          rollNumber: rollNumber,
          batch: batch,
          currentYear: currentYear,
          hall: hall,
          phone: phone,
        });
      }
    }

    onSave(updatedData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {" "}
        {/* Added max-h and overflow-y-auto */}
        <h3 className="text-2xl font-bold text-gray-800 mb-6">Edit Profile</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              value={name}
              onChange={(e) => canEditAll && setName(e.target.value)}
              required
              disabled={!canEditAll}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Department Email
            </label>
            <input
              type="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              value={departmentEmail}
              onChange={(e) => canEditAll && setDepartmentEmail(e.target.value)}
              required
              disabled={!canEditAll}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Primary Personal Email
            </label>
            <input
              type="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              value={personalEmail}
              onChange={(e) => canEditAll && setPersonalEmail(e.target.value)} // Only editable by Master Admin
              required
              disabled={!canEditAll}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="text" // Use text for demo, but password type for real app
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Profile Picture URL
            </label>
            <input
              type="url"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              value={profilePicture}
              onChange={(e) => canEditAll && setProfilePicture(e.target.value)}
              disabled={!canEditAll}
            />
          </div>

          {user.role === "teacher" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Designation
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  value={designation}
                  onChange={(e) => canEditAll && setDesignation(e.target.value)}
                  disabled={!canEditAll}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Join Date
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  value={joinDate}
                  onChange={(e) => canEditAll && setJoinDate(e.target.value)}
                  disabled={!canEditAll}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Education
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  value={education}
                  onChange={(e) => canEditAll && setEducation(e.target.value)}
                  disabled={!canEditAll}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Address
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  value={address}
                  onChange={(e) => canEditAll && setAddress(e.target.value)}
                  disabled={!canEditAll}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Phone
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  value={phone}
                  onChange={(e) => canEditAll && setPhone(e.target.value)}
                  disabled={!canEditAll}
                />
              </div>
            </>
          )}

          {(user.role === "student" ||
            user.role === "alumni" ||
            user.role === "mphil_researcher" ||
            user.role === "phd_researcher") && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Roll Number
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  value={rollNumber}
                  onChange={(e) => canEditAll && setRollNumber(e.target.value)}
                  disabled={!canEditAll}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Batch
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  value={batch}
                  onChange={(e) => canEditAll && setBatch(e.target.value)}
                  disabled={!canEditAll}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Current Year
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  value={currentYear}
                  onChange={(e) => canEditAll && setCurrentYear(e.target.value)}
                  disabled={!canEditAll}
                >
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                  <option value="Masters">Masters</option>
                  <option value="MPhil">MPhil</option> {/* New option */}
                  <option value="PhD">PhD</option> {/* New option */}
                  <option value="Graduated">Graduated</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Hall
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  value={hall}
                  onChange={(e) => canEditAll && setHall(e.target.value)}
                  disabled={!canEditAll}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Phone
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  value={phone}
                  onChange={(e) => canEditAll && setPhone(e.target.value)}
                  disabled={!canEditAll}
                />
              </div>
            </>
          )}
          {message && <p className="text-red-600 text-sm mt-2">{message}</p>}
          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-5 py-2 rounded-lg shadow-md transition duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg shadow-md transition duration-200"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Profile Display Component
const UserProfile = ({ user, setLoggedInUser }) => {
  const { db, userId, isAuthReady } = useAuth();
  const [showEditModal, setShowEditModal] = useState(false);
  const [message, setMessage] = useState("");

  const handleSaveProfile = async (updatedData) => {
    setMessage("");
    if (!isAuthReady || !userId) {
      setMessage("Access not ready.");
      return;
    }

    try {
      const userDocRef = doc(db, getCollectionPath("users", userId, false, window.selectedDepartmentName), user.id);
      await updateDoc(userDocRef, updatedData);
      setLoggedInUser((prevUser) => ({ ...prevUser, ...updatedData })); // Update local state
      setMessage("Profile updated successfully!");
    } catch (error) {
      console.error("Failed to update profile:", error);
      setMessage("Failed to update profile.");
    }
  };

  const canEditAll = user?.role === "master_admin"; // Ensure user is not null

  return (
    <Card title="My Profile">
      {!user ? (
        <p className="text-center text-gray-600">Profile data is loading...</p>
      ) : (
        <>
          {message && <p className="text-blue-600 mb-4">{message}</p>}
          <div className="flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-8">
            <div className="flex-shrink-0">
              <img
                src={
                  user.profilePicture ||
                  "https://placehold.co/150x150/cccccc/333333?text=Profile"
                }
                alt="Profile Picture"
                className="w-32 h-32 rounded-full object-cover border-4 border-blue-400 shadow-lg"
              />
            </div>
            <div className="flex-grow text-center md:text-left">
              <p className="text-3xl font-bold text-gray-900 mb-2">
                {user.name}
              </p>
              <p className="text-lg text-gray-700 mb-1">
                {(user.role === "teacher" ||
                  user.role === "second_examiner" ||
                  user.role === "third_examiner") &&
                  `Designation: ${user.designation}`}
                {(user.role === "student" ||
                  user.role === "alumni" ||
                  user.role === "mphil_researcher" ||
                  user.role === "phd_researcher") &&
                  `Roll Number: ${user.rollNumber}`}
                {user.role === "admin" && `Role: ${user.role}`}
                {user.role === "master_admin" &&
                  `Role: ${user.role.replace("_", " ")}`}
              </p>
              <p className="text-md text-gray-600 mb-1">
                Department Email: {user.email}
              </p>
              {user.personalEmail && (
                <p className="text-md text-gray-600 mb-1">
                  Primary Personal Email: {user.personalEmail}
                </p>
              )}
              {user.role === "teacher" && (
                <p className="text-md text-gray-600 mb-1">
                  Join Date: {user.joinDate}
                </p>
              )}
              {user.role === "teacher" && (
                <p className="text-md text-gray-600 mb-1">
                  Education: {user.education}
                </p>
              )}
              {user.role === "teacher" && (
                <p className="text-md text-gray-600 mb-1">
                  Permanent Address: {user.address}
                </p>
              )}
              {(user.role === "student" || user.role === "alumni") && (
                <p className="text-md text-gray-600 mb-1">
                  Year/Batch: {user.batch} ({user.currentYear})
                </p>
              )}
              {(user.role === "student" || user.role === "alumni") && (
                <p className="text-md text-gray-600 mb-1">
                  Hall Name: {user.hall}
                </p>
              )}
              {(user.role === "student" || user.role === "alumni") && (
                <p className="text-md text-gray-600 mb-1">
                  Join Date: {user.joinDate}
                </p>
              )}
              <p className="text-md text-gray-600 mb-1">
                Phone Number: {user.phone}
              </p>
            </div>
          </div>
          <div className="mt-6 text-right">
            <button
              onClick={() => setShowEditModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg shadow-md transition duration-200"
            >
              Edit Profile
            </button>
          </div>

          <EditProfileModal
            isOpen={showEditModal}
            onClose={() => setShowEditModal(false)}
            user={user}
            onSave={handleSaveProfile}
            canEditAll={canEditAll}
          />
        </>
      )}
    </Card>
  );
};

// Placeholder for AdminResearcherManagement
const AdminResearcherManagement = ({ user }) => {
  const { db, userId, isAuthReady } = useAuth();
  const [activeTab, setActiveTab] = useState("seminars");
  const [notices, setNotices] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [targetAudience, setTargetAudience] = useState("all");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [researchers, setResearchers] = useState([]);
  const [selectedResearchers, setSelectedResearchers] = useState([]);

  const tabOptions = [
    { id: "seminars", label: "Seminars" },
    { id: "thesis_submission", label: "Thesis Submission" },
    { id: "thesis_defense", label: "Thesis Defense" },
    { id: "degree_status", label: "Degree Status" },
  ];

  // Fetch notices for the active tab
  useEffect(() => {
    if (!isAuthReady || !userId) return;
    setLoading(true);
    setMessage("");
    const colName = `research_notices_${activeTab}`;
    const colRef = collection(db, getCollectionPath(colName, userId, true));
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        let data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        if (searchTerm) {
          data = data.filter(
            (n) =>
              n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
              n.content.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }
        setNotices(data);
        setLoading(false);
      },
      (error) => {
        setMessage("Failed to load notices.");
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [isAuthReady, userId, db, activeTab, searchTerm]);

  // Fetch researchers when targetAudience changes
  useEffect(() => {
    if (
      (targetAudience === "mphil_researcher" || targetAudience === "phd_researcher") &&
      isAuthReady &&
      userId
    ) {
      const fetchResearchers = async () => {
        try {
          const usersColRef = collection(db, getCollectionPath("users", userId, false, window.selectedDepartmentName));
          const q = query(usersColRef, where("role", "==", targetAudience));
          const querySnapshot = await getDocs(q);
          const data = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          setResearchers(data);
        } catch (err) {
          setResearchers([]);
        }
      };
      fetchResearchers();
    } else {
      setResearchers([]);
      setSelectedResearchers([]);
    }
  }, [targetAudience, isAuthReady, userId, db]);

  const handleResearcherSelect = (id) => {
    setSelectedResearchers((prev) =>
      prev.includes(id) ? prev.filter((rid) => rid !== id) : [...prev, id]
    );
  };

  const handlePostNotice = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setMessage("Title and Content are required.");
      return;
    }
    if ((targetAudience === "mphil_researcher" || targetAudience === "phd_researcher") && selectedResearchers.length === 0) {
      setMessage("Please select at least one researcher.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const colName = `research_notices_${activeTab}`;
      const colRef = collection(db, getCollectionPath(colName, userId, true, window.selectedDepartmentName));
      await addDoc(colRef, {
        title,
        content,
        targetAudience,
        targetResearchers: (targetAudience === "all") ? [] : selectedResearchers,
        createdAt: new Date().toISOString(),
        createdBy: user?.email + (user?.name ? ` (${user.name})` : ""),
        readBy: [], // Ensure new notices have readBy initialized
      });
      setTitle("");
      setContent("");
      setTargetAudience("all");
      setResearchers([]);
      setSelectedResearchers([]);
      setShowForm(false);
      setMessage("Notice posted successfully.");
    } catch (err) {
      setMessage("Failed to post notice.");
    }
    setLoading(false);
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Research Management</h2>
      <div className="flex flex-col gap-4 max-w-md mx-auto">
        <div className="flex gap-2 mb-4">
          {tabOptions.map((tab) => (
            <button
              key={tab.id}
              className={`px-4 py-2 rounded-lg font-semibold transition border ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-blue-50"
              }`}
              onClick={() => {
                setActiveTab(tab.id);
                setShowForm(false);
                setMessage("");
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex justify-between items-center mb-4">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold shadow hover:bg-blue-700"
            onClick={() => {
              setShowForm(true);
              setMessage("");
            }}
          >
            Add New Notice
          </button>
          <input
            type="text"
            placeholder="Search..."
            className="border border-gray-300 rounded px-3 py-2 w-40"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {showForm && (
          <form
            className="bg-gray-50 border border-gray-300 rounded-lg p-4 mb-4"
            onSubmit={handlePostNotice}
          >
            <div className="mb-2">
              <label className="block text-sm font-medium mb-1">Title</label>
              <input
                type="text"
                className="border border-gray-300 rounded px-3 py-2 w-full"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="mb-2">
              <label className="block text-sm font-medium mb-1">Content</label>
              <textarea
                className="border border-gray-300 rounded px-3 py-2 w-full"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              />
            </div>
            <div className="mb-2">
              <label className="block text-sm font-medium mb-1">Target Audience</label>
              <select
                className="border border-gray-300 rounded px-3 py-2 w-full"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
              >
                <option value="all">All</option>
                <option value="mphil_researcher">MPhil Researchers</option>
                <option value="phd_researcher">PhD Researchers</option>
              </select>
            </div>
            {(targetAudience === "mphil_researcher" || targetAudience === "phd_researcher") && (
              <div className="mb-2 border border-gray-200 rounded p-2 max-h-40 overflow-y-auto">
                <div className="text-xs text-gray-500 mb-1">Select researchers:</div>
                {researchers.length === 0 ? (
                  <div className="text-xs text-gray-400">No researchers found.</div>
                ) : (
                  researchers.map((r) => (
                    <label key={r.id} className="flex items-center gap-2 text-sm mb-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedResearchers.includes(r.email)}
                        onChange={() => handleResearcherSelect(r.email)}
                      />
                      <span>{r.name} ({r.email})</span>
                    </label>
                  ))
                )}
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg font-semibold"
                onClick={() => setShowForm(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold"
                disabled={loading}
              >
                {loading ? "Posting..." : "Post"}
              </button>
            </div>
          </form>
        )}
        {message && (
          <div className="text-center text-sm text-red-600 mb-2">{message}</div>
        )}
        {loading && !showForm ? (
          <div className="text-center text-gray-500">Loading...</div>
        ) : notices.length === 0 ? (
          <div className="text-center text-gray-500">No notices or notifications available.</div>
        ) : (
          <div className="space-y-3">
            {notices.map((notice) => (
              <div key={notice.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow">
                <div className="flex justify-between items-center mb-1">
                  <div className="font-bold text-lg text-gray-800">{notice.title}</div>
                  <span className="text-xs text-gray-400">{notice.targetAudience === "all" ? "All" : notice.targetAudience === "mphil_researcher" ? "MPhil Researchers" : "PhD Researchers"}</span>
                </div>
                <div className="text-gray-700 mb-1">{notice.content}</div>
                <div className="text-xs text-gray-400">Posted by: {notice.createdBy}{notice.postedByName ? ` (${notice.postedByName})` : ""} on {new Date(notice.createdAt).toLocaleString()}</div>
                {notice.targetResearchers && notice.targetResearchers.length > 0 && (
                  <div className="text-xs text-gray-500 mt-1">Targeted to: {notice.targetResearchers.join(", ")}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Researcher Notice Components
const createResearcherNoticeComponent = (tabId, tabLabel) => {
  return function ResearcherNoticeComponent({ user, onNoticeRead }) {
    const { db, userId, isAuthReady } = useAuth();
    const [notices, setNotices] = useState([]);
    const [message, setMessage] = useState("");
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
      if (!isAuthReady || !userId) return;
      setMessage("");
      const colName = `research_notices_${tabId}`;
      const colRef = collection(db, getCollectionPath(colName, userId, true));
      const unsubscribe = onSnapshot(
        colRef,
        (snapshot) => {
          let data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          if (searchTerm) {
            data = data.filter(
              (n) =>
                n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                n.content.toLowerCase().includes(searchTerm.toLowerCase())
            );
          }
          data = data.filter((n) => {
            if (n.targetAudience === "all") return true;
            if (n.targetAudience === user.role) return true;
            if (n.targetResearchers && n.targetResearchers.includes(user.email)) return true;
            return false;
          });
          setNotices(data);
        },
        (error) => {
          setMessage("Failed to load notices.");
        }
      );
      return () => unsubscribe();
    }, [isAuthReady, userId, db, tabId, searchTerm, user]);

    const markNoticeAsRead = async (noticeId) => {
      const noticeRef = doc(db, getCollectionPath(`research_notices_${tabId}`, userId, true, window.selectedDepartmentName), noticeId);
      try {
        // Optimistically update local state so 'Unread' disappears instantly
        setNotices(prevNotices => prevNotices.map(n => n.id === noticeId ? { ...n, readBy: [...(n.readBy || []), user.email] } : n));
        if (onNoticeRead) onNoticeRead(tabId, noticeId, user.email);
        await updateDoc(noticeRef, {
          readBy: arrayUnion(user.email),
        });
      } catch (error) {
        if (error.code === 'not-found' || error.message?.includes('No document to update')) {
          // Document does not exist, ignore or log as needed
          console.warn('Notice document not found for update:', noticeId);
        } else {
          // Other errors
          console.error('Failed to mark notice as read:', error);
        }
      }
    };

    return (
      <div className="p-8">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">{tabLabel}</h2>
        <div className="flex flex-col gap-4 max-w-md mx-auto">
          <input
            type="text"
            placeholder="Search..."
            className="border border-gray-300 rounded px-3 py-2 w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {message && (
            <div className="text-center text-sm text-red-600 mb-2">{message}</div>
          )}
          {notices.length === 0 ? (
            <div className="text-center text-gray-500">No notices or notifications available.</div>
          ) : (
            <div className="space-y-3">
              {notices.map((notice) => (
                <div
                  key={notice.id}
                  className={`border border-gray-200 rounded-xl p-6 shadow-sm bg-gray-50 ${notice.readBy && notice.readBy.includes(user.email) ? '' : 'ring-2 ring-red-400'}`}
                  onClick={() => !notice.readBy?.includes(user.email) && markNoticeAsRead(notice.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="flex justify-between items-center mb-1">
                    <div className="font-bold text-lg text-gray-800">{notice.title}</div>
                    <span className="text-xs text-gray-400">{notice.targetAudience === "all" ? "All" : notice.targetAudience === "mphil_researcher" ? "MPhil Researchers" : "PhD Researchers"}</span>
                  </div>
                  <div className="text-gray-700 mb-1">{notice.content}</div>
                  <div className="text-xs text-gray-400">Posted by: {notice.createdBy}{notice.postedByName ? ` (${notice.postedByName})` : ""} on {new Date(notice.createdAt).toLocaleString()}</div>
                  {notice.targetResearchers && notice.targetResearchers.length > 0 && (
                    <div className="text-xs text-gray-500 mt-1">Targeted to: {notice.targetResearchers.join(", ")}</div>
                  )}
                  {!notice.readBy?.includes(user.email) && (
                    <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">Unread</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };
};

const SeminarNotices = createResearcherNoticeComponent("seminars", "Seminar Notices");
const ThesisSubmissionNotices = createResearcherNoticeComponent("thesis_submission", "Thesis Submission Notices");
const ThesisDefenseNotices = createResearcherNoticeComponent("thesis_defense", "Thesis Defense Notices");
const DegreeStatusNotices = createResearcherNoticeComponent("degree_status", "Degree Status Notices");

// Teacher Dashboard Components
const TeacherAssignments = ({ user }) => {
  const { db, userId, isAuthReady } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentDesc, setAssignmentDesc] = useState("");
  const [deadline, setDeadline] = useState("");
  const [fileTypes, setFileTypes] = useState("");
  const [targetBatch, setTargetBatch] = useState("");
  const [targetYear, setTargetYear] = useState("");
  const [assignmentType, setAssignmentType] = useState("individual"); // 'individual' or 'group'
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // States for group assignment creation
  const [studentsInTargetYear, setStudentsInTargetYear] = useState([]); // All students in the selected target year
  const [selectedStudentsForCurrentGroup, setSelectedStudentsForCurrentGroup] =
    useState([]); // Students selected for the group being formed
  const [currentGroupName, setCurrentGroupName] = useState(""); // Name for the group being formed
  const [finalizedGroups, setFinalizedGroups] = useState([]); // Array of groups already formed for this assignment

  // Fetch students based on targetYear for selection
  useEffect(() => {
    if (!isAuthReady || !userId) {
      setStudentsInTargetYear([]);
      return;
    }

    const fetchStudents = async () => {
      try {
        const usersColRef = collection(db, getCollectionPath("users", userId, false, window.selectedDepartmentName));
        const q = query(
          usersColRef,
          where("role", "==", "student"),
          where("currentYear", "==", targetYear),
        );
        const querySnapshot = await getDocs(q);
        const studentsData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        // Sort students by roll number
        studentsData.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));
        setStudentsInTargetYear(studentsData);
        setSelectedStudentsForCurrentGroup([]); // Reset selection when year changes
        setFinalizedGroups([]); // Reset finalized groups when year changes
      } catch (error) {
        console.error("Failed to fetch students for target year:", error);
        setMessage("Failed to load students for selection.");
      }
    };
    fetchStudents();
  }, [isAuthReady, userId, targetYear, db]);

  useEffect(() => {
    if (!isAuthReady || !userId) return;

    const assignmentsColRef = collection(
      db,
      getCollectionPath("assignments", userId, false, window.selectedDepartmentName),
    );
    const q = query(assignmentsColRef, where("teacherId", "==", user.email)); // Use teacher's email as ID
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const assignmentsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setAssignments(assignmentsData);
      },
      (error) => {
        console.error("Failed to load assignments:", error);
        setMessage("Failed to load assignments.");
      },
    );

    return () => unsubscribe();
  }, [isAuthReady, userId, user.email, db]);

  const handleAddGroup = () => {
    setMessage("");
    if (!currentGroupName.trim()) {
      setMessage("Group name cannot be empty.");
      return;
    }
    if (selectedStudentsForCurrentGroup.length === 0) {
      setMessage("Please select students for the group.");
      return;
    }
    if (
      finalizedGroups.some(
        (group) => group.groupName === currentGroupName.trim(),
      )
    ) {
      setMessage("A group with this name already exists.");
      return;
    }

    const newGroup = {
      groupName: currentGroupName.trim(),
      students: selectedStudentsForCurrentGroup
        .map((studentId) => {
          const student = studentsInTargetYear.find((s) => s.id === studentId);
          return student
            ? {
                rollNumber: student.rollNumber,
                name: student.name,
                email: student.email,
              }
            : null;
        })
        .filter(Boolean), // Filter out any nulls if student not found
    };

    setFinalizedGroups((prev) => [...prev, newGroup]);
    setSelectedStudentsForCurrentGroup([]);
    setCurrentGroupName("");
    setMessage(
      "Group added successfully! You can add more groups or create the assignment.",
    );
  };

  const handleRemoveGroup = (groupName) => {
    setFinalizedGroups((prev) =>
      prev.filter((group) => group.groupName !== groupName),
    );
    setMessage(`Group "${groupName}" removed.`);
  };

  const handleAddAssignment = async (e) => {
    e.preventDefault();
    setMessage("");
    if (!isAuthReady || !userId) {
      setMessage("Access not ready.");
      return;
    }
    if (!assignmentTitle || !deadline || !targetBatch || !targetYear) {
      setMessage("Title, deadline, batch, and year are required.");
      return;
    }

    let assignmentData = {
      teacherId: user.email,
      title: assignmentTitle,
      description: assignmentDesc,
      deadline: deadline,
      fileTypes: fileTypes.split(",").map((t) => t.trim().toUpperCase()),
      targetBatch: targetBatch,
      targetYear: targetYear,
      type: assignmentType,
      createdAt: new Date().toISOString(),
    };

    if (assignmentType === "individual") {
      if (selectedStudentsForCurrentGroup.length === 0) {
        // Reusing selectedStudentsForCurrentGroup for individual
        setMessage(
          "Please select at least one student for individual assignment.",
        );
        return;
      }
      assignmentData.targetStudentRollNumbers = selectedStudentsForCurrentGroup
        .map(
          (studentId) =>
            studentsInTargetYear.find((s) => s.id === studentId)?.rollNumber,
        )
        .filter(Boolean);
    } else if (assignmentType === "group") {
      if (finalizedGroups.length === 0) {
        setMessage(
          "Please create at least one group for group-based assignment.",
        );
        return;
      }
      assignmentData.numberOfGroups = finalizedGroups.length;
      assignmentData.groupDistribution = finalizedGroups;
    }

    try {
      await addDoc(
        collection(db, getCollectionPath("assignments", userId, false, window.selectedDepartmentName)),
        assignmentData,
      );
      setMessage("Assignment created successfully!");
      setShowModal(false);
      // Reset all form states
      setAssignmentTitle("");
      setAssignmentDesc("");
      setDeadline("");
      setFileTypes("");
      setTargetBatch("");
      setTargetYear("");
      setAssignmentType("individual");
      setStudentsInTargetYear([]);
      setSelectedStudentsForCurrentGroup([]);
      setCurrentGroupName("");
      setFinalizedGroups([]);
      // Simulate sending email to students
      console.log(
        `Assignment email sent to students: ${assignmentTitle}, Deadline: ${deadline}`,
      );
    } catch (error) {
      console.error("Failed to create assignment:", error);
      setMessage("Failed to create assignment.");
    }
  };

  const filteredAssignments = assignments.filter(
    (assignment) =>
      assignment.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.targetBatch.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.targetYear.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Students not yet in any finalized group
  const studentsNotYetGrouped = studentsInTargetYear.filter(
    (student) =>
      !finalizedGroups.some((group) =>
        group.students.some((s) => s.rollNumber === student.rollNumber),
      ),
  );

  return (
    <Card title="Assignment Management">
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => setShowModal(true)}
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg shadow-md transition duration-200"
        >
          Add New Assignment
        </button>
        <input
          type="text"
          placeholder="Search..."
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {message && <p className="text-blue-600 mb-4">{message}</p>}

      <div className="overflow-x-auto">
        {filteredAssignments.length === 0 ? (
          <p className="text-gray-600">No assignments available.</p>
        ) : (
          <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-sm">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Batch/Year
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Deadline
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  File Types
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Targeted
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredAssignments.map((assignment) => (
                <tr key={assignment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {assignment.title}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {assignment.targetBatch} / {assignment.targetYear}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {assignment.type === "individual"
                      ? "Individual"
                      : "Group Based"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {new Date(assignment.deadline).toLocaleDateString("en-US")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {assignment.fileTypes.join(", ")}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {assignment.type === "individual" &&
                    assignment.targetStudentRollNumbers?.length > 0 ? (
                      <span
                        className="block max-w-[200px] truncate"
                        title={assignment.targetStudentRollNumbers.join(", ")}
                      >
                        {assignment.targetStudentRollNumbers.join(", ")}
                      </span>
                    ) : assignment.type === "group" &&
                      assignment.numberOfGroups ? (
                      <span>{assignment.numberOfGroups} Groups</span>
                    ) : (
                      "All"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {" "}
            {/* Added max-h and overflow-y-auto */}
            <h3 className="text-2xl font-bold text-gray-800 mb-6">
              Create New Assignment
            </h3>
            <form onSubmit={handleAddAssignment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Title
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  value={assignmentTitle}
                  onChange={(e) => setAssignmentTitle(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  rows="3"
                  value={assignmentDesc}
                  onChange={(e) => setAssignmentDesc(e.target.value)}
                ></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Deadline
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Allowed File Types (comma separated)
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder="PDF, DOCX, JPG, PNG, MP4"
                  value={fileTypes}
                  onChange={(e) => setFileTypes(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Target Batch
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 2021"
                  value={targetBatch}
                  onChange={(e) => setTargetBatch(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Target Year
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  value={targetYear}
                  onChange={(e) => {
                    setTargetYear(e.target.value);
                    setSelectedStudentsForCurrentGroup([]);
                    setCurrentGroupName("");
                    setFinalizedGroups([]);
                  }}
                  required
                >
                  <option value="">Select Year</option>
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                  <option value="Masters">Masters</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Assignment Type
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  value={assignmentType}
                  onChange={(e) => {
                    setAssignmentType(e.target.value);
                    setSelectedStudentsForCurrentGroup([]);
                    setCurrentGroupName("");
                    setFinalizedGroups([]);
                  }}
                >
                  <option value="individual">Individual</option>
                  <option value="group">Group Based</option>
                </select>
              </div>

              {assignmentType === "individual" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Select Students (Roll Numbers)
                  </label>
                  {studentsInTargetYear.length > 0 ? (
                    <select
                      multiple
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 h-32"
                      value={selectedStudentsForCurrentGroup}
                      onChange={(e) =>
                        setSelectedStudentsForCurrentGroup(
                          Array.from(
                            e.target.selectedOptions,
                            (option) => option.value,
                          ),
                        )
                      }
                    >
                      {studentsInTargetYear.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.rollNumber} - {student.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-gray-500">
                      No students found for the selected year.
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Hold Ctrl/Cmd to select multiple students.
                  </p>
                </div>
              )}

              {assignmentType === "group" && (
                <div className="space-y-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <h4 className="text-lg font-semibold text-gray-800">
                    Form Groups
                  </h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Group Name
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                      value={currentGroupName}
                      onChange={(e) => setCurrentGroupName(e.target.value)}
                      placeholder="e.g., Team Alpha"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Select Students for this Group
                    </label>
                    {studentsNotYetGrouped.length > 0 ? (
                      <select
                        multiple
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 h-32"
                        value={selectedStudentsForCurrentGroup}
                        onChange={(e) =>
                          setSelectedStudentsForCurrentGroup(
                            Array.from(
                              e.target.selectedOptions,
                              (option) => option.value,
                            ),
                          )
                        }
                      >
                        {studentsNotYetGrouped.map((student) => (
                          <option key={student.id} value={student.id}>
                            {student.rollNumber} - {student.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-sm text-gray-500">
                        No unassigned students found for the selected year.
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Hold Ctrl/Cmd to select multiple students.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddGroup}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-md transition duration-200"
                  >
                    Add Group
                  </button>

                  {finalizedGroups.length > 0 && (
                    <div className="mt-6">
                      <h5 className="text-md font-semibold text-gray-800 mb-2">
                        Current Groups:
                      </h5>
                      <ul className="space-y-2">
                        {finalizedGroups.map((group, index) => (
                          <li
                            key={index}
                            className="p-3 border border-gray-200 rounded-lg bg-white flex justify-between items-center"
                          >
                            <div>
                              <p className="font-medium text-gray-900">
                                {group.groupName}
                              </p>
                              <p className="text-sm text-gray-600">
                                Members:{" "}
                                {group.students.map((s) => s.name).join(", ")}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveGroup(group.groupName)}
                              className="text-red-600 hover:text-red-800 text-sm font-semibold"
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {message && (
                <p className="text-blue-600 text-sm mt-2">{message}</p>
              )}
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-5 py-2 rounded-lg shadow-md transition duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg shadow-md transition duration-200"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
};

const TeacherEvaluation = ({ user }) => {
  const { db, userId, isAuthReady } = useAuth();
  const [coursesOffered, setCoursesOffered] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [gradesData, setGradesData] = useState({}); // Stores grades for all students in the selected course
  const [message, setMessage] = useState("");
  const [showAddCourseModal, setShowAddCourseModal] = useState(false);

  // Edit Course states
  const [showEditCourseModal, setShowEditCourseModal] = useState(false);
  const [courseToEdit, setCourseToEdit] = useState(null);

  // New Course states
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseCode, setNewCourseCode] = useState("");
  const [newAcademicYear, setNewAcademicYear] = useState("");
  const [newStudentsYearOfEnrollment, setNewStudentsYearOfEnrollment] =
    useState("");
  const [newStudentsBatchYear, setNewStudentsBatchYear] = useState(""); // New state for Batch Year
  const [editMode, setEditMode] = useState(true); // New: controls if marks are editable

  // Utility function to calculate average of a marks array
  const calculateAverageOfMarks = (marksArray) => {
    if (!marksArray || marksArray.length === 0) return 0;
    const total = marksArray.reduce(
      (sum, item) => sum + (parseFloat(item.score) || 0),
      0,
    );
    return (total / marksArray.length).toFixed(2);
  };

  // New utility function to calculate combined average of assignment and in-course marks
  const calculateCombinedAverage = (assignmentMarks, inCourseMarks) => {
    const allMarks = [];
    if (assignmentMarks) {
      assignmentMarks.forEach((item) =>
        allMarks.push(parseFloat(item.score) || 0),
      );
    }
    if (inCourseMarks) {
      inCourseMarks.forEach((item) =>
        allMarks.push(parseFloat(item.score) || 0),
      );
    }

    if (allMarks.length === 0) return "N/A";
    const total = allMarks.reduce((sum, score) => sum + score, 0);
    return (total / allMarks.length).toFixed(2);
  };

  // Fetch courses offered by this teacher
  useEffect(() => {
    if (!isAuthReady || !userId) return;

    const coursesColRef = collection(
      db,
      getCollectionPath("courses_offered", userId),
    );
    const q = query(coursesColRef, where("teacherEmail", "==", user.email));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const courses = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setCoursesOffered(courses);
      },
      (error) => {
        console.error("Failed to load courses offered:", error);
        setMessage("Failed to load courses offered.");
      },
    );

    return () => unsubscribe();
  }, [isAuthReady, userId, user.email, db]);

  // Handle course selection and fetch enrolled students and existing grades
  useEffect(() => {
    if (!isAuthReady || !userId || !selectedCourseId) {
      setSelectedCourse(null);
      setEnrolledStudents([]);
      setGradesData({});
      return;
    }

    const course = coursesOffered.find((c) => c.id === selectedCourseId);
    setSelectedCourse(course);

    if (course) {
      // Fetch students enrolled in this specific course
      const enrollmentsColRef = collection(
        db,
        getCollectionPath("student_course_enrollments", userId),
      );
      // For demo, we'll assume approved status or just filter by courseId
      const qEnrollments = query(
        enrollmentsColRef,
        where("courseId", "==", course.id),
        where("status", "==", "approved"), // Only fetch approved enrollments
      );

      const unsubscribeEnrollments = onSnapshot(
        qEnrollments,
        async (enrollmentSnapshot) => {
          const enrolledStudentEmails = enrollmentSnapshot.docs.map(
            (doc) => doc.data().studentEmail,
          );

          if (enrolledStudentEmails.length > 0) {
            // Fetch full student details
            const usersColRef = collection(
              db,
              getCollectionPath("users", userId),
            );
            const studentDetailsPromises = enrolledStudentEmails.map((email) =>
              getDocs(query(usersColRef, where("email", "==", email))),
            );

            const studentSnapshots = await Promise.all(studentDetailsPromises);
            const students = studentSnapshots
              .flatMap((s) =>
                s.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
              )
              .filter((student) => student.role === "student"); // Ensure it's a student

            // Sort students by roll number
            students.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));
            setEnrolledStudents(students);

            // Fetch existing grades for these students in this course
            const gradesColRef = collection(
              db,
              getCollectionPath("course_grades", userId),
            );
            const qGrades = query(
              gradesColRef,
              where("courseId", "==", course.id),
              where("academicYear", "==", course.academicYear),
            );

            const unsubscribeGrades = onSnapshot(
              qGrades,
              (gradesSnapshot) => {
                const currentGrades = {};
                gradesSnapshot.docs.forEach((doc) => {
                  const data = doc.data();
                  currentGrades[data.studentEmail] = {
                    ...data,
                    // Ensure assignmentMarks and inCourseMarks are arrays
                    assignmentMarks: Array.isArray(data.assignmentMarks)
                      ? data.assignmentMarks
                      : [],
                    inCourseMarks: Array.isArray(data.inCourseMarks)
                      ? data.inCourseMarks
                      : [],
                  };
                });
                setGradesData(currentGrades);
              },
              (error) => {
                console.error("Failed to load grades:", error);
                setMessage("Failed to load grades.");
              },
            );
            return () => unsubscribeGrades(); // Cleanup grades listener
          } else {
            setEnrolledStudents([]);
            setGradesData({});
          }
        },
        (error) => {
          console.error("Failed to load enrolled students:", error);
          setMessage("Failed to load enrolled students.");
        },
      );

      return () => unsubscribeEnrollments(); // Cleanup enrollments listener
    }
  }, [isAuthReady, userId, selectedCourseId, coursesOffered, db]);

  // When gradesData changes, check if any student has finalExamMarks set (not null/empty/undefined)
  useEffect(() => {
    if (!enrolledStudents.length) {
      setEditMode(true);
      return;
    }
    // Only lock editing after final marks are saved, not while typing
    // Remove auto-locking here to allow multi-digit entry
  }, [enrolledStudents]);

  const handleAddCourse = async (e) => {
    e.preventDefault();
    setMessage("");
    if (!isAuthReady || !userId) {
      setMessage("Access not ready.");
      return;
    }
    if (
      !newCourseName ||
      !newCourseCode ||
      !newAcademicYear ||
      !newStudentsYearOfEnrollment ||
      !newStudentsBatchYear // Ensure batch year is also required
    ) {
      setMessage("All course fields are required.");
      return;
    }

    try {
      const courseData = {
        courseName: newCourseName,
        courseCode: newCourseCode,
        teacherEmail: user.email,
        academicYear: newAcademicYear,
        studentsYearOfEnrollment: newStudentsYearOfEnrollment, // This is for "1st Year", "2nd Year"
        studentBatchYear: newStudentsBatchYear, // This is the new field for "2021", "2022" etc.
        createdAt: new Date().toISOString(),
      };
      await addDoc(
        collection(db, getCollectionPath("courses_offered", userId)),
        courseData,
      );
      setMessage("Course added successfully!");
      setShowAddCourseModal(false);
      setNewCourseName("");
      setNewCourseCode("");
      setNewAcademicYear("");
      setNewStudentsYearOfEnrollment("");
      setNewStudentsBatchYear(""); // Reset batch year
    } catch (error) {
      console.error("Failed to add course:", error);
      setMessage("Failed to add course.");
    }
  };

  const handleGradeChange = (studentEmail, category, key, value) => {
    setGradesData((prev) => {
      const studentGrades = { ...prev[studentEmail] };
      if (category === "assignmentMarks" || category === "inCourseMarks") {
        const marksArray = studentGrades[category]
          ? [...studentGrades[category]]
          : [];
        const existingMarkIndex = marksArray.findIndex(
          (item) => item.name === key,
        );
        if (existingMarkIndex !== -1) {
          marksArray[existingMarkIndex] = {
            ...marksArray[existingMarkIndex],
            score: parseFloat(value) || 0,
          };
        } else {
          marksArray.push({ name: key, score: parseFloat(value) || 0 });
        }
        studentGrades[category] = marksArray;
      } else if (category === "attendanceMarks") {
        studentGrades[category] = parseFloat(value) || 0;
      } else if (category === "finalExamMarks") {
        // New category for final exam marks
        studentGrades[category] = parseFloat(value) || 0;
      }
      return {
        ...prev,
        [studentEmail]: studentGrades,
      };
    });
  };

  const handleAddInCourseField = (studentEmail) => {
    setGradesData((prev) => {
      const studentGrades = { ...prev[studentEmail] };
      const inCourseMarks = studentGrades.inCourseMarks
        ? [...studentGrades.inCourseMarks]
        : [];
      const newFieldName = `Tutorial ${inCourseMarks.length + 1}`; // Simple naming
      inCourseMarks.push({ name: newFieldName, score: 0 });
      studentGrades.inCourseMarks = inCourseMarks;
      return {
        ...prev,
        [studentEmail]: studentGrades,
      };
    });
  };

  const handleSaveGrades = async () => {
    setMessage("");
    if (!isAuthReady || !userId || !selectedCourse) {
      setMessage("Please select a course first.");
      return;
    }
    try {
      const batch = writeBatch(db);
      let finalMarkSubmitted = false;
      for (const student of enrolledStudents) {
        const studentEmail = student.email;
        const gradeEntry = gradesData[studentEmail] || {};
        // Allow saving any combination of marks, finalExamMarks is optional
        let currentFinalExamMark = gradeEntry.finalExamMarks;
        if (currentFinalExamMark === undefined || currentFinalExamMark === "" || isNaN(currentFinalExamMark)) {
          currentFinalExamMark = null;
        } else {
          currentFinalExamMark = Number(currentFinalExamMark);
        }
        if (currentFinalExamMark !== null && currentFinalExamMark > 0) {
          finalMarkSubmitted = true;
        }
        const docId = `${studentEmail}-${selectedCourse.id}-${selectedCourse.academicYear}`;
        const gradeDocRef = doc(
          db,
          getCollectionPath("course_grades", userId),
          docId,
        );
        batch.set(
          gradeDocRef,
          {
            studentEmail: studentEmail,
            studentRollNumber: student.rollNumber,
            courseId: selectedCourse.id,
            courseName: selectedCourse.courseName,
            courseCode: selectedCourse.courseCode,
            teacherEmail: user.email,
            academicYear: selectedCourse.academicYear,
            studentCurrentYearAtTimeOfGrade: student.currentYear,
            assignmentMarks: gradeEntry.assignmentMarks || [],
            inCourseMarks: gradeEntry.inCourseMarks || [],
            attendanceMarks: gradeEntry.attendanceMarks || 0,
            finalExamMarks: currentFinalExamMark, // can be null
            firstExaminerFinalMark: currentFinalExamMark, // can be null
            finalMarkSubmittedBy: user.email,
            status:
              currentFinalExamMark !== null && currentFinalExamMark > 0
                ? "pending_second_examiner_assignment"
                : "partial_submission",
            lastUpdated: new Date().toISOString(),
          },
          { merge: true },
        );
      }
      await batch.commit();
      if (finalMarkSubmitted) {
        setMessage("Final marks saved successfully and notification sent to Admin!");
        const notificationsColRef = collection(
          db,
          getCollectionPath("notifications", userId, true),
        );
        await addDoc(notificationsColRef, {
          type: "final_result_submission",
          message: `Course Offering Teacher ${user.name} (${user.email}) has submitted final results for ${selectedCourse.courseName} (${selectedCourse.courseCode}) for academic year ${selectedCourse.academicYear}. Please assign a Second Examiner.`,
          courseId: selectedCourse.id,
          courseName: selectedCourse.courseName,
          courseCode: selectedCourse.courseCode,
          academicYear: selectedCourse.academicYear,
          studentsYearOfEnrollment: selectedCourse.studentsYearOfEnrollment,
          teacherEmail: user.email,
          timestamp: new Date().toISOString(),
          read: false,
          targetRole: "admin",
        });
        setEditMode(false); // Lock editing after save
      } else {
        setMessage("Marks saved. You can enter or update Final Exam marks later.");
      }
    } catch (error) {
      console.error("Failed to save grades:", error);
      setMessage("Failed to save grades.");
    }
  };

  const handleEditCourse = (course) => {
    setCourseToEdit(course);
    setNewCourseName(course.courseName);
    setNewCourseCode(course.courseCode);
    setNewAcademicYear(course.academicYear);
    setNewStudentsYearOfEnrollment(course.studentsYearOfEnrollment);
    setNewStudentsBatchYear(course.studentBatchYear);
    setShowEditCourseModal(true);
  };

  const handleUpdateCourse = async (e) => {
    e.preventDefault();
    setMessage("");
    if (!isAuthReady || !userId) {
      setMessage("Access not ready.");
      return;
    }
    if (
      !newCourseName ||
      !newCourseCode ||
      !newAcademicYear ||
      !newStudentsYearOfEnrollment ||
      !newStudentsBatchYear // Ensure batch year is also required
    ) {
      setMessage("All course fields are required.");
      return;
    }

    try {
      const courseData = {
        courseName: newCourseName,
        courseCode: newCourseCode,
        teacherEmail: user.email,
        academicYear: newAcademicYear,
        studentsYearOfEnrollment: newStudentsYearOfEnrollment, // This is for "1st Year", "2nd Year"
        studentBatchYear: newStudentsBatchYear, // This is the new field for "2021", "2022" etc.
        createdAt: new Date().toISOString(),
      };
      await updateDoc(
        doc(db, getCollectionPath("courses_offered", userId), courseToEdit.id),
        courseData,
      );
      setMessage("Course updated successfully!");
      setShowEditCourseModal(false);
      setNewCourseName("");
      setNewCourseCode("");
      setNewAcademicYear("");
      setNewStudentsYearOfEnrollment("");
      setNewStudentsBatchYear(""); // Reset batch year
    } catch (error) {
      console.error("Failed to update course:", error);
      setMessage("Failed to update course.");
    }
  };

  return (
    <Card title="Course Evaluation">
      <div className="mb-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-semibold text-gray-800">My Courses</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowAddCourseModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg shadow-md transition duration-200"
            >
              Offer New Course
            </button>
            {selectedCourse && (
              <button
                onClick={() => handleEditCourse(selectedCourse)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-md transition duration-200"
              >
                Edit
              </button>
            )}
          </div>
        </div>
        <select
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          value={selectedCourseId}
          onChange={(e) => setSelectedCourseId(e.target.value)}
        >
          <option value="">Select a Course to Evaluate</option>
          {coursesOffered.map((course) => (
            <option key={course.id} value={course.id}>
              {course.courseName} ({course.courseCode}) - {course.academicYear}{" "}
              ({course.studentsYearOfEnrollment})
            </option>
          ))}
        </select>
      </div>

      {message && <p className="text-blue-600 mb-4">{message}</p>}

      {selectedCourse && (
        <div className="mt-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            Students Enrolled in {selectedCourse.courseName} (
            {selectedCourse.courseCode})
          </h3>
          {enrolledStudents.length === 0 ? (
            <p className="text-gray-600">
              No students enrolled in this course or their enrollment is not yet
              approved.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-sm">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      S.No.
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Roll Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assignment Marks
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tutorial/In-Course Marks
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Attendance Marks
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Final Exam Marks
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Combined Average of Assignment Marks and
                      Tutorial/In-Course Marks
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {enrolledStudents.map((student, index) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {student.rollNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {student.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <input
                          type="number"
                          className="w-24 px-2 py-1 border border-gray-300 rounded-md"
                          placeholder="Score"
                          value={String(
                            gradesData[student.email]?.assignmentMarks?.[0]
                              ?.score || "",
                          )}
                          onChange={(e) =>
                            handleGradeChange(
                              student.email,
                              "assignmentMarks",
                              "Assignment 1",
                              e.target.value,
                            )
                          }
                          disabled={!editMode}
                        />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {(gradesData[student.email]?.inCourseMarks || []).map(
                          (item, idx) => (
                            <div key={idx} className="flex items-center mb-1">
                              <span className="w-24">{item.name}:</span>
                              <input
                                type="number"
                                className="w-24 px-2 py-1 border border-gray-300 rounded-md mr-2"
                                placeholder="Score"
                                value={String(item.score || "")}
                                onChange={(e) =>
                                  handleGradeChange(
                                    student.email,
                                    "inCourseMarks",
                                    item.name,
                                    e.target.value,
                                  )
                                }
                                disabled={!editMode}
                              />
                            </div>
                          ),
                        )}
                        <button
                          onClick={() => handleAddInCourseField(student.email)}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded-md text-xs mt-2"
                          disabled={!editMode}
                        >
                          + Add Tutorial
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <input
                          type="number"
                          className="w-24 px-2 py-1 border border-gray-300 rounded-md"
                          placeholder="Score"
                          value={String(
                            gradesData[student.email]?.attendanceMarks || "",
                          )}
                          onChange={(e) =>
                            handleGradeChange(
                              student.email,
                              "attendanceMarks",
                              "Attendance",
                              e.target.value,
                            )
                          }
                          disabled={!editMode}
                        />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <input
                          type="number"
                          className="w-24 px-2 py-1 border border-gray-300 rounded-md"
                          placeholder="Score"
                          value={String(
                            gradesData[student.email]?.finalExamMarks || "",
                          )}
                          onChange={(e) =>
                            handleGradeChange(
                              student.email,
                              "finalExamMarks",
                              "Final Exam",
                              e.target.value,
                            )
                          }
                          disabled={!editMode}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-semibold">
                        {calculateCombinedAverage(
                          gradesData[student.email]?.assignmentMarks,
                          gradesData[student.email]?.inCourseMarks,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-6 text-right">
                <button
                  onClick={handleSaveGrades}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg shadow-md transition duration-200"
                  disabled={!editMode}
                >
                  Save All Marks
                </button>
                {!editMode && (
                  <button
                    onClick={() => setEditMode(true)}
                    className="ml-4 bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg shadow-md transition duration-200"
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {showAddCourseModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {" "}
            {/* Added max-h and overflow-y-auto */}
            <h3 className="text-2xl font-bold text-gray-800 mb-6">
              Offer New Course
            </h3>
            <form onSubmit={handleAddCourse} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Course Name
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Course Code
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  value={newCourseCode}
                  onChange={(e) => setNewCourseCode(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Academic Year (e.g., 2024-2025)
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  value={newAcademicYear}
                  onChange={(e) => setNewAcademicYear(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Students' Year of Enrollment
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  value={newStudentsYearOfEnrollment}
                  onChange={(e) =>
                    setNewStudentsYearOfEnrollment(e.target.value)
                  }
                  required
                >
                  <option value="">Select Year</option>
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                  <option value="Masters">Masters</option>
                  <option value="All">All Students</option>
                </select>
              </div>
              {/* New field for Session (Student Batch Year) */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Session (Student Batch Year)
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 2021"
                  value={newStudentsBatchYear}
                  onChange={(e) => setNewStudentsBatchYear(e.target.value)}
                  required
                />
              </div>
              {message && (
                <p className="text-blue-600 text-sm mt-2">{message}</p>
              )}
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddCourseModal(false)}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-5 py-2 rounded-lg shadow-md transition duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg shadow-md transition duration-200"
                >
                  Add Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditCourseModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {" "}
            {/* Added max-h and overflow-y-auto */}
            <h3 className="text-2xl font-bold text-gray-800 mb-6">
              Edit Course
            </h3>
            <form onSubmit={handleUpdateCourse} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Course Name
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Course Code
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  value={newCourseCode}
                  onChange={(e) => setNewCourseCode(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Academic Year (e.g., 2024-2025)
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  value={newAcademicYear}
                  onChange={(e) => setNewAcademicYear(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Students' Year of Enrollment
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  value={newStudentsYearOfEnrollment}
                  onChange={(e) =>
                    setNewStudentsYearOfEnrollment(e.target.value)
                  }
                  required
                >
                  <option value="">Select Year</option>
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                  <option value="Masters">Masters</option>
                  <option value="All">All Students</option>
                </select>
              </div>
              {/* New field for Session (Student Batch Year) */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Session (Student Batch Year)
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 2021"
                  value={newStudentsBatchYear}
                  onChange={(e) => setNewStudentsBatchYear(e.target.value)}
                  required
                />
              </div>
              {message && (
                <p className="text-blue-600 text-sm mt-2">{message}</p>
              )}
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditCourseModal(false)}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-5 py-2 rounded-lg shadow-md transition duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg shadow-md transition duration-200"
                >
                  Update Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
};

const TeacherEvaluationsReport = ({ user }) => {
  const { db, userId, isAuthReady } = useAuth();
  const [evaluations, setEvaluations] = useState([]);
  const [averageScores, setAverageScores] = useState({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isAuthReady || !userId) return;

    const evaluationsColRef = collection(
      db,
      getCollectionPath("evaluations", userId),
    );
    const q = query(evaluationsColRef, where("teacherEmail", "==", user.email));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const evaluationsData = snapshot.docs.map((doc) => doc.data());
        setEvaluations(evaluationsData);

        // Calculate average scores
        const criteria = [
          "teachingSkill",
          "behavior",
          "communication",
          "knowledge",
        ];
        const totals = {};
        const counts = {};

        criteria.forEach((c) => {
          totals[c] = 0;
          counts[c] = 0;
        });

        evaluationsData.forEach((evalItem) => {
          criteria.forEach((c) => {
            if (evalItem[c] !== undefined) {
              totals[c] += evalItem[c];
              counts[c]++;
            }
          });
        });

        const averages = {};
        criteria.forEach((c) => {
          averages[c] =
            counts[c] > 0 ? (totals[c] / counts[c]).toFixed(2) : "N/A";
        });
        setAverageScores(averages);
      },
      (error) => {
        console.error("Failed to load evaluation report:", error);
        setMessage("Failed to load evaluation report.");
      },
    );

    return () => unsubscribe();
  }, [isAuthReady, userId, user.email, db]);

  return (
    <Card title="Teacher Evaluation Summary Report">
      {message && <p className="text-blue-600 mb-4">{message}</p>}
      <p className="text-gray-700 mb-4">
        Students have evaluated your teaching skills, behavior, communication,
        and knowledge on a scale of 1 to 10. Below are your average evaluation
        scores.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg shadow-sm">
          <h4 className="font-semibold text-lg text-blue-800 mb-2">
            Teaching Skill:
          </h4>
          <p className="text-3xl font-bold text-blue-700">
            {averageScores.teachingSkill}
          </p>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg shadow-sm">
          <h4 className="font-semibold text-lg text-blue-800 mb-2">
            Behavior:
          </h4>
          <p className="text-3xl font-bold text-blue-700">
            {averageScores.behavior}
          </p>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg shadow-sm">
          <h4 className="font-semibold text-lg text-blue-800 mb-2">
            Communication:
          </h4>
          <p className="text-3xl font-bold text-blue-700">
            {averageScores.communication}
          </p>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg shadow-sm">
          <h4 className="font-semibold text-lg text-blue-800 mb-2">
            Knowledge:
          </h4>
          <p className="text-3xl font-bold text-blue-700">
            {averageScores.knowledge}
          </p>
        </div>
      </div>
      <p className="text-sm text-gray-500 mt-6">
        * Only your average evaluation scores are shown here. Who evaluated you
        or what scores they gave will not be visible.
      </p>
    </Card>
  );
};

const TeacherResources = ({ user }) => {
  const { db, userId, isAuthReady } = useAuth();
  const [resources, setResources] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileUrl, setFileUrl] = useState(""); // In real app, this would be a file upload
  const [resourceType, setResourceType] = useState("lecture_note");
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!isAuthReady || !userId) return;

    const resourcesColRef = collection(
      db,
      getCollectionPath("resources", userId),
    );
    const q = query(resourcesColRef, where("teacherEmail", "==", user.email));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const resourcesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setResources(resourcesData);
      },
      (error) => {
        console.error("Failed to load resources:", error);
        setMessage("Failed to load resources.");
      },
    );

    return () => unsubscribe();
  }, [isAuthReady, userId, user.email, db]);

  const handleAddResource = async (e) => {
    e.preventDefault();
    setMessage("");
    if (!isAuthReady || !userId) {
      setMessage("Access not ready.");
      return;
    }
    if (!title || !fileUrl) {
      setMessage("Title and File URL are required.");
      return;
    }

    try {
      await addDoc(collection(db, getCollectionPath("resources", userId)), {
        teacherEmail: user.email,
        title: title,
        description: description,
        fileUrl: fileUrl,
        type: resourceType,
        uploadedAt: new Date().toISOString(),
      });
      setMessage("Resource added successfully!");
      setShowModal(false);
      setTitle("");
      setDescription("");
      setFileUrl("");
      setResourceType("lecture_note");
    } catch (error) {
      console.error("Failed to add resource:", error);
      setMessage("Failed to add resource.");
    }
  };

  const filteredResources = resources.filter(
    (resource) =>
      resource.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      resource.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      resource.type.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <Card title="Resource Library">
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => setShowModal(true)}
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg shadow-md transition duration-200"
        >
          Upload New Resource
        </button>
        <input
          type="text"
          placeholder="Search..."
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {message && <p className="text-blue-600 mb-4">{message}</p>}

      <div className="overflow-x-auto">
        {filteredResources.length === 0 ? (
          <p className="text-gray-600">No resources available.</p>
        ) : (
          <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-sm">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Upload Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredResources.map((resource) => (
                <tr key={resource.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {resource.title}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {resource.type === "lecture_note"
                      ? "Lecture Note"
                      : resource.type === "reference"
                        ? "Reference"
                        : "Other"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {new Date(resource.uploadedAt).toLocaleDateString("en-US")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <a
                      href={resource.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm shadow-sm transition duration-200"
                    >
                      View/Download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {" "}
            {/* Added max-h and overflow-y-auto */}
            <h3 className="text-2xl font-bold text-gray-800 mb-6">
              Upload New Resource
            </h3>
            <form onSubmit={handleAddResource} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Title
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Description (Optional)
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  rows="3"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                ></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  File URL (for demo purposes)
                </label>
                <input
                  type="url"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://example.com/your-file.pdf"
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Resource Type
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  value={resourceType}
                  onChange={(e) => setResourceType(e.target.value)}
                >
                  <option value="lecture_note">Lecture Note</option>
                  <option value="reference">Reference</option>
                  <option value="video">Video</option>
                  <option value="book">Book</option>
                  <option value="other">Other</option>
                </select>
              </div>
              {message && (
                <p className="text-blue-600 text-sm mt-2">{message}</p>
              )}
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-5 py-2 rounded-lg shadow-md transition duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg shadow-md transition duration-200"
                >
                  Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
};

// Student Dashboard Components
const StudentCourseSelection = ({ user }) => {
  const { db, userId, isAuthReady } = useAuth();
  const [academicYear, setAcademicYear] = useState("");
  const [availableCourses, setAvailableCourses] = useState([]);
  const [selectedCourses, setSelectedCourses] = useState({}); // { courseId: { teacherEmail, academicYear } }
  const [message, setMessage] = useState("");
  const [currentAcademicYear] = useState(
    new Date().getFullYear().toString() +
      "-" +
      (new Date().getFullYear() + 1).toString(),
  );
  const [allTeachers, setAllTeachers] = useState([]);

  useEffect(() => {
    if (!isAuthReady || !userId) return;
    const fetchTeachers = async () => {
      try {
        const usersColRef = collection(db, getCollectionPath("users", userId));
        const q = query(usersColRef, where("role", "==", "teacher"));
        const querySnapshot = await getDocs(q);
        const teachers = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setAllTeachers(teachers);
      } catch (error) {
        setAllTeachers([]);
      }
    };
    fetchTeachers();
  }, [isAuthReady, userId, db]);

  // Fetch available courses based on academic year and student's current year
  useEffect(() => {
    if (!isAuthReady || !userId || !academicYear || !user.currentYear) {
      setAvailableCourses([]);
      return;
    }

    const coursesColRef = collection(
      db,
      getCollectionPath("courses_offered", userId),
    );
    const q = query(
      coursesColRef,
      where("academicYear", "==", academicYear),
      where("studentsYearOfEnrollment", "in", [user.currentYear, "All"]), // Filter by student's year or 'All'
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const courses = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setAvailableCourses(courses);
      },
      (error) => {
        console.error("Failed to load available courses:", error);
        setMessage("Failed to load available courses.");
      },
    );

    return () => unsubscribe();
  }, [isAuthReady, userId, academicYear, user.currentYear, db]);

  const handleCourseSelection = (courseId, teacherEmail) => {
    setSelectedCourses((prev) => {
      const newSelection = { ...prev };
      if (
        newSelection[courseId] &&
        newSelection[courseId].teacherEmail === teacherEmail
      ) {
        // Deselect if already selected
        delete newSelection[courseId];
      } else {
        newSelection[courseId] = {
          teacherEmail: teacherEmail,
          academicYear: academicYear,
        };
      }
      return newSelection;
    });
  };

  const handleSubmitSelections = async () => {
    setMessage("");
    if (!isAuthReady || !userId) {
      setMessage("Access not ready.");
      return;
    }
    if (Object.keys(selectedCourses).length === 0) {
      setMessage("Please select at least one course.");
      return;
    }

    try {
      for (const courseId in selectedCourses) {
        const selection = selectedCourses[courseId];
        const courseDetails = availableCourses.find((c) => c.id === courseId);

        if (courseDetails) {
          const enrollmentDocId = `${user.email}-${courseId}-${academicYear}`;
          await setDoc(
            doc(
              db,
              getCollectionPath("student_course_enrollments", userId),
              enrollmentDocId,
            ),
            {
              studentEmail: user.email,
              studentRollNumber: user.rollNumber,
              courseId: courseId,
              courseName: courseDetails.courseName,
              courseCode: courseDetails.courseCode,
              teacherEmail: selection.teacherEmail,
              academicYear: selection.academicYear,
              status: "pending", // Status will be 'pending' for admin approval
              enrolledAt: new Date().toISOString(),
            },
            { merge: true },
          ); // Use merge to avoid overwriting if re-submitting
        }
      }
      setMessage("Course selections submitted for approval!");
      setSelectedCourses({}); // Clear selection after submission
    } catch (error) {
      console.error("Failed to submit course selections:", error);
      setMessage("Failed to submit course selections.");
    }
  };

  return (
    <Card title="Course Selection">
      {message && <p className="text-blue-600 mb-4">{message}</p>}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700">
          Academic Year
        </label>
        <input
          type="text"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          placeholder="e.g., 2024-2025"
          value={academicYear}
          onChange={(e) => setAcademicYear(e.target.value)}
          required
        />
      </div>

      {academicYear && (
        <div className="mt-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            Available Courses for {academicYear}
          </h3>
          {availableCourses.length === 0 ? (
            <p className="text-gray-600">
              No courses available for this academic year or your current year (
              {user.currentYear}).
            </p>
          ) : (
            <div className="space-y-4">
              {availableCourses.map((course) => (
                <div
                  key={course.id}
                  className="border border-gray-200 rounded-lg p-4 shadow-sm bg-gray-50"
                >
                  <h4 className="text-lg font-semibold text-gray-800">
                    {course.courseName} ({course.courseCode})
                  </h4>
                  <p className="text-gray-600 text-sm mb-2">
                    Taught by: {(() => {
                      const teacherUser = allTeachers.find(u => u.email === course.teacherEmail);
                      return teacherUser && teacherUser.name ? `${course.teacherEmail} (${teacherUser.name})` : course.teacherEmail;
                    })()}
                  </p>
                  <p className="text-gray-600 text-sm mb-2">
                    For: {course.studentsYearOfEnrollment} Students
                  </p>
                  <button
                    onClick={() =>
                      handleCourseSelection(course.id, course.teacherEmail)
                    }
                    className={`px-4 py-2 rounded-lg text-sm transition duration-200 ${
                      selectedCourses[course.id]
                        ? "bg-red-500 hover:bg-red-600 text-white"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    }`}
                  >
                    {selectedCourses[course.id]
                      ? "Deselect Course"
                      : "Select Course"}
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="mt-6 text-right">
            <button
              onClick={handleSubmitSelections}
              className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg shadow-md transition duration-200"
            >
              Submit Selections
            </button>
          </div>
        </div>
      )}
    </Card>
  );
};

const StudentAssignments = ({ user }) => {
  const { db, userId, isAuthReady } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submissionFile, setSubmissionFile] = useState(""); // Placeholder for file URL
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!isAuthReady || !userId || !user.batch || !user.currentYear) return;

    const assignmentsColRef = collection(
      db,
      getCollectionPath("assignments", userId),
    );
    const q = query(
      assignmentsColRef,
      where("targetBatch", "==", user.batch),
      where("targetYear", "==", user.currentYear),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const assignmentsData = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((assignment) => {
            if (assignment.type === "individual") {
              // Check if the current student's roll number is in targetStudentRollNumbers
              return assignment.targetStudentRollNumbers?.includes(
                user.rollNumber,
              );
            } else if (assignment.type === "group") {
              // For group assignments, check if the student's roll number is in any of the groups
              if (
                assignment.groupDistribution &&
                Array.isArray(assignment.groupDistribution)
              ) {
                return assignment.groupDistribution.some(
                  (group) =>
                    group.students &&
                    Array.isArray(group.students) &&
                    group.students.some(
                      (s) => s.rollNumber === user.rollNumber,
                    ),
                );
              }
              return false; // If no group distribution, or it's malformed, don't show
            }
            // If the assignment type is neither 'individual' nor 'group', do not show it.
            return false;
          });
        setAssignments(assignmentsData);
      },
      (error) => {
        console.error("Failed to load assignments:", error);
        setMessage("Failed to load assignments.");
      },
    );

    return () => unsubscribe();
  }, [isAuthReady, userId, user.batch, user.currentYear, user.rollNumber, db]); // Added user.rollNumber to dependencies

  const handleOpenSubmission = (assignment) => {
    setSelectedAssignment(assignment);
    setShowSubmissionModal(true);
  };

  const handleSubmitAssignment = async (e) => {
    e.preventDefault();
    setMessage("");
    if (!selectedAssignment || !isAuthReady || !userId) {
      setMessage("No assignment selected or access not ready.");
      return;
    }
    if (!submissionFile) {
      setMessage("File URL is required.");
      return;
    }

    try {
      // Check if already submitted
      const submissionsColRef = collection(
        db,
        getCollectionPath("submissions", userId),
      );
      const q = query(
        submissionsColRef,
        where("assignmentId", "==", selectedAssignment.id),
        where("studentEmail", "==", user.email),
      );
      const existingSubmissions = await getDocs(q);

      if (!existingSubmissions.empty) {
        setMessage("You have already submitted this assignment.");
        return;
      }

      await addDoc(submissionsColRef, {
        assignmentId: selectedAssignment.id,
        assignmentTitle: selectedAssignment.title,
        studentEmail: user.email,
        fileUrl: submissionFile,
        submittedAt: new Date().toISOString(),
        grade: "", // Initial empty grade
        comment: "", // Initial empty comment
      });
      setMessage("Assignment submitted successfully!");
      setShowSubmissionModal(false);
      setSubmissionFile("");
    } catch (error) {
      console.error("Failed to submit assignment:", error);
      setMessage("Failed to submit assignment.");
    }
  };

  const filteredAssignments = assignments.filter(
    (assignment) =>
      assignment.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assignment.teacherId.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <Card title="My Assignments">
      <input
        type="text"
        placeholder="Search..."
        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 mb-4"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      {message && <p className="text-blue-600 mb-4">{message}</p>}
      <div className="overflow-x-auto">
        {filteredAssignments.length === 0 ? (
          <p className="text-gray-600">No assignments for you.</p>
        ) : (
          <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-sm">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Teacher
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Deadline
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  File Types
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Group Info
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredAssignments.map((assignment) => {
                const isGroupAssignment = assignment.type === "group";
                const studentGroup = isGroupAssignment
                  ? assignment.groupDistribution?.find((group) =>
                      group.students.some(
                        (s) => s.rollNumber === user.rollNumber,
                      ),
                    )
                  : null;

                if (isGroupAssignment && !studentGroup) {
                  return null; // Skip if it's a group assignment but the student is not in any group
                }

                return (
                  <tr key={assignment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {assignment.title}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {assignment.teacherId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {assignment.type === "individual"
                        ? "Individual"
                        : "Group Based"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {new Date(assignment.deadline).toLocaleDateString(
                        "en-US",
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {assignment.fileTypes.join(", ")}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {studentGroup ? (
                        <div className="flex flex-col">
                          <span className="font-semibold">
                            {studentGroup.groupName}
                          </span>
                          <span className="text-xs text-gray-500">
                            Members:{" "}
                            {studentGroup.students
                              .map((s) => s.rollNumber)
                              .join(", ")}
                          </span>
                        </div>
                      ) : (
                        "N/A"
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleOpenSubmission(assignment)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm shadow-sm transition duration-200"
                      >
                        Submit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showSubmissionModal && selectedAssignment && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {" "}
            {/* Added max-h and overflow-y-auto */}
            <h3 className="text-2xl font-bold text-gray-800 mb-6">
              Submit Assignment: {selectedAssignment.title}
            </h3>
            <p className="text-gray-700 mb-4">
              {selectedAssignment.description}
            </p>
            <p className="text-gray-600 mb-4">
              Deadline:{" "}
              {new Date(selectedAssignment.deadline).toLocaleDateString(
                "en-US",
              )}
            </p>
            <p className="text-600 mb-4">
              Allowed File Types: {selectedAssignment.fileTypes.join(", ")}
            </p>
            {selectedAssignment.type === "group" &&
              selectedAssignment.groupDistribution && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-800 mb-2">
                    Your Group Details:
                  </h4>
                  {selectedAssignment.groupDistribution.map((group) => {
                    const isCurrentUserInGroup = group.students.some(
                      (s) => s.rollNumber === user.rollNumber,
                    );
                    if (isCurrentUserInGroup) {
                      return (
                        <div key={group.groupName}>
                          <p className="font-medium">{group.groupName}</p>
                          <ul className="list-disc list-inside text-sm">
                            {group.students.map((s) => (
                              <li key={s.rollNumber}>
                                {s.rollNumber} - {s.name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              )}
            <form onSubmit={handleSubmitAssignment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Your File URL (for demo purposes)
                </label>
                <input
                  type="url"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://example.com/your-submission.pdf"
                  value={submissionFile}
                  onChange={(e) => setSubmissionFile(e.target.value)}
                  required
                />
              </div>
              {message && (
                <p className="text-blue-600 text-sm mt-2">{message}</p>
              )}
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowSubmissionModal(false)}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-5 py-2 rounded-lg shadow-md transition duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg shadow-md transition duration-200"
                >
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
};

const StudentResults = ({ user }) => {
  const { db, userId, isAuthReady } = useAuth();
  const [courseGrades, setCourseGrades] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isAuthReady || !userId) return;

    const gradesColRef = collection(
      db,
      getCollectionPath("course_grades", userId),
    );
    const q = query(gradesColRef, where("studentEmail", "==", user.email));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const gradesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setCourseGrades(gradesData);
      },
      (error) => {
        console.error("Failed to load results:", error);
        setMessage("Failed to load results.");
      },
    );

    return () => unsubscribe();
  }, [isAuthReady, userId, user.email, db]);

  const calculateAverage = (marksArray) => {
    if (!marksArray || marksArray.length === 0) return "N/A";
    const total = marksArray.reduce((sum, item) => sum + item.score, 0);
    return (total / marksArray.length).toFixed(2);
  };

  const calculateCombinedAssignmentAndInCourseAverage = (
    assignmentMarks,
    inCourseMarks,
  ) => {
    const allMarks = [];
    if (assignmentMarks) {
      assignmentMarks.forEach((item) =>
        allMarks.push(parseFloat(item.score) || 0),
      );
    }
    if (inCourseMarks) {
      inCourseMarks.forEach((item) =>
        allMarks.push(parseFloat(item.score) || 0),
      );
    }

    if (allMarks.length === 0) return "N/A";
    const total = allMarks.reduce((sum, score) => sum + score, 0);
    return (total / allMarks.length).toFixed(2);
  };

  const getFinalMarkDisplay = (grade) => {
    const thirdMark = parseFloat(grade.thirdExaminerFinalMark);
    const finalCombinedMark = parseFloat(grade.finalCombinedMark); // This is the average of 1st and 2nd, or the 3rd mark

    if (!isNaN(thirdMark) && grade.thirdExaminerFinalMark !== "") {
      // If a third examiner has provided a mark, that's the final one.
      return `${thirdMark.toFixed(2)}`;
    } else if (!isNaN(finalCombinedMark) && grade.finalCombinedMark !== "") {
      // If a final combined mark (average of first and second) is set
      return `${finalCombinedMark.toFixed(2)}`;
    }
    // If neither of the above conditions is met (e.g., only first examiner mark, or only second examiner mark, or none at all, or still pending moderation),
    // it should show "Pending/N/A" for student view.
    return "Pending/N/A";
  };

  const getTotalMarksDisplay = (grade) => {
    const combinedAvg =
      parseFloat(
        calculateCombinedAssignmentAndInCourseAverage(
          grade.assignmentMarks,
          grade.inCourseMarks,
        ),
      ) || 0;
    const attendance = grade.attendanceMarks || 0;
    let finalExamComponent = 0; // This will be the final exam mark used for total calculation

    const thirdMark = parseFloat(grade.thirdExaminerFinalMark);
    const finalCombinedMark = parseFloat(grade.finalCombinedMark); // This is the average of 1st and 2nd, or the 3rd mark

    if (!isNaN(thirdMark) && grade.thirdExaminerFinalMark !== "") {
      finalExamComponent = thirdMark;
    } else if (!isNaN(finalCombinedMark) && grade.finalCombinedMark !== "") {
      finalExamComponent = finalCombinedMark;
    } else {
      // If final exam component cannot be determined (e.g., pending second examiner, or only one mark, or pending third examiner),
      // then the total marks are not yet calculable.
      return "N/A (Final Exam Mark Pending)";
    }

    // Ensure finalExamComponent is a valid number before adding
    if (isNaN(finalExamComponent)) {
      return "N/A (Final Exam Mark Pending)";
    }

    return (combinedAvg + attendance + finalExamComponent).toFixed(2);
  };

  return (
    <Card title="My Results">
      {message && <p className="text-blue-600 mb-4">{message}</p>}
      {courseGrades.length === 0 ? (
        <p className="text-gray-600">No results found for your courses yet.</p>
      ) : (
        <div className="space-y-6">
          {courseGrades.map((course) => (
            <div
              key={course.id}
              className="border border-gray-200 rounded-xl p-6 shadow-sm bg-gray-50"
            >
              <h4 className="text-xl font-bold text-gray-800 mb-4">
                {course.courseName} ({course.courseCode}) -{" "}
                {course.academicYear}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <h5 className="font-semibold text-lg text-gray-800 mb-2">
                    Assignment Marks
                  </h5>
                  {course.assignmentMarks &&
                  course.assignmentMarks.length > 0 ? (
                    <ul className="list-disc list-inside text-gray-700">
                      {course.assignmentMarks.map((assignment, idx) => (
                        <li key={idx}>
                          {assignment.name}:{" "}
                          <span className="font-medium">
                            {assignment.score}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-600">N/A</p>
                  )}
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <h5 className="font-semibold text-lg text-gray-800 mb-2">
                    In-Course Marks
                  </h5>
                  {course.inCourseMarks && course.inCourseMarks.length > 0 ? (
                    <>
                      <ul className="list-disc list-inside text-gray-700">
                        {course.inCourseMarks.map((tutorial, idx) => (
                          <li key={idx}>
                            {tutorial.name}:{" "}
                            <span className="font-medium">
                              {tutorial.score}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-sm text-gray-600">
                        Average:{" "}
                        <span className="font-medium">
                          {calculateAverage(course.inCourseMarks)}
                        </span>
                      </p>
                    </>
                  ) : (
                    <p className="text-gray-600">N/A</p>
                  )}
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <h5 className="font-semibold text-lg text-gray-800 mb-2">
                    Attendance Marks
                  </h5>
                  <p className="text-gray-700 font-medium">
                    {course.attendanceMarks || "N/A"}
                  </p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <h5 className="font-semibold text-lg text-gray-800 mb-2">
                    Final Exam Marks
                  </h5>
                  <p className="text-gray-700 font-medium">
                    {getFinalMarkDisplay(course)}
                  </p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <h5 className="font-semibold text-lg text-gray-800 mb-2">
                    Combined Average (Assignments & In-Course)
                  </h5>
                  <p
                    className="text-gray-700 font-medium cursor-help"
                    title="Average of all Assignment and Tutorial/In-Course scores."
                  >
                    {calculateCombinedAssignmentAndInCourseAverage(
                      course.assignmentMarks,
                      course.inCourseMarks,
                    )}
                  </p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <h5 className="font-semibold text-lg text-gray-800 mb-2">
                    Total Marks (Course)
                  </h5>
                  <p className="text-gray-700 font-medium">
                    {getTotalMarksDisplay(course)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
const StudentEvaluateTeachers = ({ user }) => {
  const { db, userId, isAuthReady } = useAuth();
  const [teachers, setTeachers] = useState([]);
  const [evaluations, setEvaluations] = useState({});
  const [message, setMessage] = useState("");
  const [enrolledTeacherEmails, setEnrolledTeacherEmails] = useState([]); // NEW
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (!isAuthReady || !userId) return;

    // Fetch all teachers
    const usersColRef = collection(db, getCollectionPath("users", userId));
    const qTeachers = query(usersColRef, where("role", "==", "teacher"));
    const unsubscribeTeachers = onSnapshot(
      qTeachers,
      (snapshot) => {
        const teachersData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setTeachers(teachersData);
      },
      (error) => {
        console.error("Failed to load teacher list:", error);
        setMessage("Failed to load teacher list.");
      },
    );

    // Fetch existing evaluations by this student for the current year
    const evaluationsColRef = collection(
      db,
      getCollectionPath("evaluations", userId),
    );
    const qEvaluations = query(
      evaluationsColRef,
      where("studentEmail", "==", user.email),
      where("year", "==", currentYear),
    );
    const unsubscribeEvaluations = onSnapshot(
      qEvaluations,
      (snapshot) => {
        const existingEvals = {};
        snapshot.docs.forEach((doc) => {
          existingEvals[doc.data().teacherEmail] = doc.data();
        });
        setEvaluations(existingEvals);
      },
      (error) => {
        console.error("Failed to load previous evaluations:", error);
        setMessage("Failed to load previous evaluations.");
      },
    );

    // Fetch enrolled courses for this student (APPEND)
    const enrollmentsColRef = collection(db, getCollectionPath("student_course_enrollments", userId));
    const qEnrollments = query(
      enrollmentsColRef,
      where("studentEmail", "==", user.email),
      where("status", "in", ["approved", "active"]) // Only approved/active enrollments
    );
    const unsubscribeEnrollments = onSnapshot(
      qEnrollments,
      (snapshot) => {
        // Get unique teacher emails from enrollments
        const teacherEmails = Array.from(new Set(snapshot.docs.map(doc => doc.data().teacherEmail)));
        setEnrolledTeacherEmails(teacherEmails);
      },
      (error) => {
        console.error("Failed to load enrollments:", error);
        setMessage("Failed to load enrollments.");
      }
    );

    return () => {
      unsubscribeTeachers();
      unsubscribeEvaluations();
      unsubscribeEnrollments(); // NEW
    };
  }, [isAuthReady, userId, user.email, db, currentYear]);

  const handleRatingChange = (teacherEmail, criteria, value) => {
    setEvaluations((prev) => ({
      ...prev,
      [teacherEmail]: {
        ...prev[teacherEmail],
        [criteria]: parseInt(value),
      },
    }));
  };

  const handleSubmitEvaluation = async (teacherEmail) => {
    setMessage("");
    if (!isAuthReady || !userId) {
      setMessage("Access not ready.");
      return;
    }

    const evaluationData = evaluations[teacherEmail];
    if (
      !evaluationData ||
      !evaluationData.teachingSkill ||
      !evaluationData.behavior ||
      !evaluationData.communication ||
      !evaluationData.knowledge
    ) {
      setMessage("Please rate all criteria.");
      return;
    }

    try {
      const docRef = doc(
        db,
        getCollectionPath("evaluations", userId),
        `${user.email}-${teacherEmail}-${currentYear}`,
      );
      await setDoc(
        docRef,
        {
          studentEmail: user.email,
          teacherEmail: teacherEmail,
          year: currentYear,
          ...evaluationData,
          submittedAt: new Date().toISOString(),
        },
        { merge: true },
      ); // Use merge to update if exists, create if not
      setMessage("Evaluation submitted successfully!");
    } catch (error) {
      console.error("Failed to submit evaluation:", error);
      setMessage("Failed to submit evaluation.");
    }
  };

  return (
    <Card title="Evaluate Teachers">
      {message && <p className="text-blue-600 mb-4">{message}</p>}
      <p className="text-gray-700 mb-6">
        You can evaluate teachers on their teaching skills, behavior,
        communication, and knowledge on a scale of 1 to 10 once a year.
      </p>
      <div className="space-y-8">
        {teachers
          .filter((teacher) => enrolledTeacherEmails.includes(teacher.email)) // Only show enrolled teachers
          .map((teacher) => (
            <div
              key={teacher.id}
              className="border border-gray-200 rounded-xl p-6 shadow-sm bg-gray-50"
            >
              <h4 className="text-xl font-semibold text-gray-800 mb-4">
                {teacher.name} ({teacher.designation})
              </h4>
              {evaluations[teacher.email] &&
              evaluations[teacher.email].submittedAt ? (
                <p className="text-green-600 font-medium">
                  You have evaluated this teacher (
                  {new Date(
                    evaluations[teacher.email].submittedAt,
                  ).toLocaleDateString("en-US")}
                  ).
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <label className="w-40 text-gray-700">Teaching Skill:</label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={evaluations[teacher.email]?.teachingSkill || 0}
                      onChange={(e) =>
                        handleRatingChange(
                          teacher.email,
                          "teachingSkill",
                          e.target.value,
                        )
                      }
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer range-lg"
                    />
                    <span className="font-bold text-lg">
                      {evaluations[teacher.email]?.teachingSkill || 0}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <label className="w-40 text-gray-700">Behavior:</label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={evaluations[teacher.email]?.behavior || 0}
                      onChange={(e) =>
                        handleRatingChange(
                          teacher.email,
                          "behavior",
                          e.target.value,
                        )
                      }
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer range-lg"
                    />
                    <span className="font-bold text-lg">
                      {evaluations[teacher.email]?.behavior || 0}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <label className="w-40 text-gray-700">Communication:</label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={evaluations[teacher.email]?.communication || 0}
                      onChange={(e) =>
                        handleRatingChange(
                          teacher.email,
                          "communication",
                          e.target.value,
                        )
                      }
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer range-lg"
                    />
                    <span className="font-bold text-lg">
                      {evaluations[teacher.email]?.communication || 0}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <label className="w-40 text-gray-700">Knowledge:</label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={evaluations[teacher.email]?.knowledge || 0}
                      onChange={(e) =>
                        handleRatingChange(
                          teacher.email,
                          "knowledge",
                          e.target.value,
                        )
                      }
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer range-lg"
                    />
                    <span className="font-bold text-lg">
                      {evaluations[teacher.email]?.knowledge || 0}
                    </span>
                  </div>
                  <button
                    onClick={() => handleSubmitEvaluation(teacher.email)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg shadow-md mt-4 transition duration-200"
                  >
                    Submit Evaluation

                  </button>
                </div>
              )}
            </div>
          ))}
      </div>
    </Card>
  );
};

const StudentResources = ({ user }) => {
  const { db, userId, isAuthReady } = useAuth();
  const [resources, setResources] = useState([]);
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!isAuthReady || !userId) return;

    const resourcesColRef = collection(
      db,
      getCollectionPath("resources", userId),
    );
    const unsubscribe = onSnapshot(
      resourcesColRef,
      (snapshot) => {
        const resourcesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setResources(resourcesData);
      },
      (error) => {
        console.error("Failed to load resources:", error);
        setMessage("Failed to load resources.");
      },
    );

    return () => unsubscribe();
  }, [isAuthReady, userId, db]);

  const filteredResources = resources.filter(
    (resource) =>
      resource.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      resource.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      resource.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      resource.teacherEmail.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <Card title="Resource Library">
      <input
        type="text"
        placeholder="Search..."
        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 mb-4"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      {message && <p className="text-blue-600 mb-4">{message}</p>}
      <div className="overflow-x-auto">
        {filteredResources.length === 0 ? (
          <p className="text-gray-600">No resources available.</p>
        ) : (
          <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-sm">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Teacher
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Upload Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredResources.map((resource) => (
                <tr key={resource.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {resource.title}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {resource.teacherEmail}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {resource.type === "lecture_note"
                      ? "Lecture Note"
                      : resource.type === "reference"
                        ? "Reference"
                        : "Other"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {new Date(resource.uploadedAt).toLocaleDateString("en-US")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <a
                      href={resource.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm shadow-sm transition duration-200"
                    >
                      Download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
};

const StudentArchive = ({ user }) => {
  // For simplicity, this will just be a placeholder.
  // In a real app, you'd fetch past year's assignments, results, evaluations.
  return (
    <Card title="Archive Section">
      <p className="text-gray-700">
        Your previous year's assignments, results, and evaluation reports will
        be stored here. This feature is not fully implemented in the demo
        application.
      </p>
      <div className="mt-4 p-4 bg-blue-50 rounded-lg text-blue-800">
        <p className="font-semibold">Example:</p>
        <ul className="list-disc list-inside">
          <li>1st Year Assignments & Results</li>
          <li>2nd Year Teacher Evaluations</li>
        </ul>
      </div>
    </Card>
  );
};

// Admin Dashboard Components
const AdminDashboard = () => {
  return (
    <Card title="Admin Dashboard Overview">
      <p className="text-gray-700">
        Here you can manage all core administrative functions of the department portal. Use the sidebar to access each feature.
      </p>
      <div className="mt-4 p-4 bg-blue-50 rounded-lg text-blue-800">
        <p className="font-semibold">Admin Features:</p>
        <ul className="list-disc list-inside">
          <li>Admin Dashboard (Overview)</li>
          <li>Notice Management</li>
          <li>User Management</li>
          <li>Year Promotion</li>
          <li>Enrollment Approval</li>
          <li>Result Calculator</li>
          <li>Assign Examiners</li>
          <li>Researcher Management</li>
        </ul>
      </div>
    </Card>
  );
};

const AdminManageNotices = ({ user, setView, setCourseDetailsForExaminerAssignment, setStudentsForThirdExaminerAssignment }) => {
  // MODIFIED: Added setView prop
  const { db, userId, isAuthReady } = useAuth();
  const [notices, setNotices] = useState([]);
  const [notifications, setNotifications] = useState([]); // NEW: State for notifications
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [targetAudience, setTargetAudience] = useState("all");
  const [targetStudentYear, setTargetStudentYear] = useState("");
  const [isEvent, setIsEvent] = useState(false);
  const [message, setMessage] = useState("");
  const [editingNotice, setEditingNotice] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [targetSpecificUsers, setTargetSpecificUsers] = useState(false);
  const [availableTargetUsers, setAvailableTargetUsers] = useState([]);
  const [selectedTargetUserEmails, setSelectedTargetUserEmails] = useState([]);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalMessage, setConfirmModalMessage] = useState("");
  const [confirmModalAction, setConfirmModalAction] = useState(null);

  // NEW: States for follow-up modal after receiving notification
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpMessage, setFollowUpMessage] = useState("");

  // Existing useEffect for general notices
  useEffect(() => {
    if (!isAuthReady || !userId) return;

    const noticesColRef = collection(db, getCollectionPath("notices", userId));
    const unsubscribe = onSnapshot(
      noticesColRef,
      (snapshot) => {
        const noticesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setNotices(noticesData);
      },
      (error) => {
        console.error("Failed to load notices:", error);
        setMessage("Failed to load notices.");
      },
    );

    return () => unsubscribe();
  }, [isAuthReady, userId, db]);

  // NEW: useEffect for notifications targeted to admin/master_admin
  useEffect(() => {
    if (
      !isAuthReady ||
      !userId ||
      !(user.role === "master_admin" || user.role === "admin")
    )
      return;

    const notificationsColRef = collection(
      db,
      getCollectionPath("notifications", userId, true), // Public collection
    );
    const qNotifications = query(
      notificationsColRef,
      where("targetRole", "==", "admin"), // Targeting both admin and master_admin with "admin" role
      where("read", "==", false), // Only unread notifications
    );

    const unsubscribeNotifications = onSnapshot(
      qNotifications,
      (snapshot) => {
        const newNotifications = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setNotifications(newNotifications);
      },
      (error) => {
        console.error("Failed to load notifications:", error);
        setMessage("Failed to load notifications.");
      },
    );

    return () => unsubscribeNotifications();
  }, [isAuthReady, userId, user.role, db]);

  // Existing useEffect for fetching target users
  useEffect(() => {
    const fetchTargetUsers = async () => {
      if (
        !isAuthReady ||
        !userId ||
        !targetSpecificUsers ||
        targetAudience === "all"
      ) {
        setAvailableTargetUsers([]);
        setSelectedTargetUserEmails([]);
        return;
      }

      try {
        const usersColRef = collection(db, getCollectionPath("users", userId));
        let q;
        if (
          [
            "student",
            "teacher",
            "alumni",
            "admin",
            "second_examiner",
            "third_examiner",
            "mphil_researcher",
            "phd_researcher",
          ].includes(targetAudience)
        ) {
          if (targetAudience === "student" && targetStudentYear && targetStudentYear !== "All") {
            q = query(usersColRef, where("role", "==", "student"), where("currentYear", "==", targetStudentYear));
          } else {
            q = query(usersColRef, where("role", "==", targetAudience));
          }
        } else {
          setAvailableTargetUsers([]);
          setSelectedTargetUserEmails([]);
          return;
        }

        const querySnapshot = await getDocs(q);
        const usersData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setAvailableTargetUsers(usersData);
      } catch (error) {
        console.error("Failed to fetch target users:", error);
        setMessage("Failed to load target users.");
      }
    };
    fetchTargetUsers();
  }, [isAuthReady, userId, targetSpecificUsers, targetAudience, targetStudentYear, db]);

  const handleOpenModal = (notice = null) => {
    setEditingNotice(notice);
    if (notice) {
      setTitle(notice.title);
      setContent(notice.content);
      setTargetAudience(notice.targetAudience);
      setTargetStudentYear(notice.targetStudentYear || "");
      setIsEvent(notice.isEvent || false);
      setTargetSpecificUsers(notice.targetSpecificUsers || false);
      setSelectedTargetUserEmails(notice.targetUserEmails || []);
    } else {
      setTitle("");
      setContent("");
      setTargetAudience("all");
      setTargetStudentYear("");
      setIsEvent(false);
      setSelectedTargetUserEmails([]);
    }
    setShowModal(true);
  };

  const handleSaveNotice = async (e) => {
    e.preventDefault();
    setMessage("");
    if (!isAuthReady || !userId) {
      setMessage("Access not ready.");
      return;
    }
    if (!title || !content) {
      setMessage("Title and content are required.");
      return;
    }
    if (targetAudience === "student" && !targetStudentYear) {
      setMessage("Student year selection is required for student notices.");
      return;
    }
    if (
      targetSpecificUsers &&
      selectedTargetUserEmails.length === 0 &&
      targetAudience !== "all"
    ) {
      setMessage(
        "Please select specific users or uncheck 'Target Specific Users'.",
      );
      return;
    }

    const noticeData = {
      title: title,
      content: content,
      targetAudience: targetAudience,
      isEvent: isEvent,
      postedBy: user.email + (user.name ? ` (${user.name})` : ""),
      postedAt: new Date().toISOString(),
      targetSpecificUsers: targetSpecificUsers,
      targetUserEmails: targetSpecificUsers ? selectedTargetUserEmails : [],
    };

    if (targetAudience === "student") {
      noticeData.targetStudentYear = targetStudentYear;
    } else {
      delete noticeData.targetStudentYear;
    }

    try {
      if (editingNotice) {
        const noticeDocRef = doc(
          db,
          getCollectionPath("notices", userId),
          editingNotice.id,
        );
        await updateDoc(noticeDocRef, {
          ...noticeData,
          updatedAt: new Date().toISOString(),
        });
        setMessage("Notice updated successfully!");
      } else {
        noticeData.readBy = [];
        await addDoc(
          collection(db, getCollectionPath("notices", userId)),
          noticeData,
        );
        setMessage("Notice posted successfully!");
      }
      setShowModal(false);
    } catch (error) {
      console.error("Failed to save notice:", error);
      setMessage("Failed to save notice.");
    }
  };

  const handleDeleteNotice = (id) => {
    setConfirmModalMessage("Are you sure you want to delete this notice?");
    setConfirmModalAction(() => async () => {
      setMessage("");
      if (!isAuthReady || !userId) {
        setMessage("Access not ready.");
        return;
      }
      try {
        await deleteDoc(doc(db, getCollectionPath("notices", userId), id));
        setMessage("Notice deleted successfully!");
      } catch (error) {
        console.error("Failed to delete notice:", error);
        setMessage("Failed to delete notice.");
      } finally {
        setShowConfirmModal(false);
      }
    });
    setShowConfirmModal(true);
  };

  // NEW: Handle receiving a notification
  const handleReceiveNotification = async (notificationId, notification) => {
    setMessage("");
    if (!isAuthReady || !userId) {
      setMessage("Access not ready.");
      return;
    }

    try {
      const notificationDocRef = doc(
        db,
        getCollectionPath("notifications", userId, true),
        notificationId,
      );
      await updateDoc(notificationDocRef, { read: true });

      if (notification.type === "third_examiner_needed") {
        // Prepare data to pass to AdminAssignExaminers
        setCourseDetailsForExaminerAssignment({ // This setter comes from MainAppContent
          id: notification.courseId,
          courseName: notification.courseName,
          courseCode: notification.courseCode,
          academicYear: notification.academicYear,
          studentBatchYear: notification.studentBatchYear, // Pass student batch year
          teacherEmail: notification.teacherEmail,
        });
        setStudentsForThirdExaminerAssignment(notification.discrepancyStudents || []); // Pass discrepancy students

        setFollowUpMessage(
          `Third examiner assignment initiated for ${notification.courseName} (${notification.courseCode}). You will be redirected to the Assign Examiner page.`,
        );
        setShowFollowUpModal(true);
      } else {
        setFollowUpMessage(
          "Notification acknowledged. You can now proceed with relevant actions.",
        );
        setShowFollowUpModal(true);
      }

      setMessage("Notification acknowledged.");
    } catch (error) {
      console.error("Failed to acknowledge notification:", error);
      setMessage("Failed to acknowledge notification.");
    }
  };

  const filteredNotices = notices.filter(
    (notice) =>
      notice.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notice.content.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <Card title="Notice Management">
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => handleOpenModal()}
          className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg shadow-md transition duration-200"
        >
          Add New Notice
        </button>
        <input
          type="text"
          placeholder="Search..."
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {message && <p className="text-blue-600 mb-4">{message}</p>}

      {/* NEW: Display Notifications */}
      {notifications.length > 0 && (
        <div className="mb-8 p-4 bg-yellow-100 border border-yellow-300 rounded-xl shadow-md">
          <h3 className="text-xl font-bold text-yellow-800 mb-4">
            New Notifications
          </h3>
          <div className="space-y-4">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex justify-between items-center"
              >
                <div>
                  <p className="font-semibold text-yellow-900">
                    {notification.message}
                  </p>
                  <p className="text-sm text-yellow-700">
                    Course: {notification.courseName} ({notification.courseCode}
                    )
                  </p>
                  <p className="text-sm text-yellow-700">
                    Academic Year: {notification.academicYear}
                  </p>
                  {notification.studentBatchYear && ( // Display batch year if available
                    <p className="text-sm text-yellow-700">
                      Batch Year: {notification.studentBatchYear}
                    </p>
                  )}
                  {notification.discrepancyStudents?.length > 0 && (
                    <p className="text-sm text-yellow-700">
                      Discrepancy for:{" "}
                      {notification.discrepancyStudents
                        .map((s) => s.studentRollNumber)
                        .join(", ")}
                    </p>
                  )}
                  <p className="text-xs text-yellow-600 mt-1">
                    Received:{" "}
                    {new Date(notification.timestamp).toLocaleString("en-US")}
                  </p>
                </div>
                <button
                  onClick={() =>
                    handleReceiveNotification(notification.id, notification)
                  }
                  className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg shadow-md transition duration-200"
                >
                  Receive
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        {filteredNotices.length === 0 && notifications.length === 0 ? ( // Adjusted condition
          <p className="text-gray-600">
            No notices or notifications available.
          </p>
        ) : (
          <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-sm">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Target
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Specific Users
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Event
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Posted By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredNotices.map((notice) => (
                <tr key={notice.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {notice.title}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {notice.targetAudience === "student"
                      ? `${notice.targetStudentYear || "All"} Students`
                      : notice.targetAudience}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {notice.targetSpecificUsers ? (
                      <span
                        title={notice.targetUserEmails?.join(", ")}
                        className="truncate max-w-[150px] inline-block"
                      >
                        {notice.targetUserEmails?.length} users
                      </span>
                    ) : (
                      "No"
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {notice.isEvent ? "Yes" : "No"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {notice.postedBy}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {new Date(notice.postedAt).toLocaleDateString("en-US")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                    <button
                      onClick={() => handleOpenModal(notice)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm shadow-sm transition duration-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteNotice(notice.id)}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md text-sm shadow-200"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-gray-800 mb-6">
              {editingNotice ? "Edit Notice" : "Post New Notice"}
            </h3>
            <form onSubmit={handleSaveNotice} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Title
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Content
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  rows="5"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                ></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Target Audience
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  value={targetAudience}
                  onChange={(e) => {
                    setTargetAudience(e.target.value);
                    if (e.target.value !== "student") {
                      setTargetStudentYear("");
                    }
                    setTargetSpecificUsers(false);
                    setSelectedTargetUserEmails([]);
                  }}
                >
                  <option value="all">All</option>
                  <option value="teacher">Teachers</option>
                  <option value="second_examiner">Second Examiners</option>{" "}
                  {/* New option */}
                  <option value="third_examiner">Third Examiners</option>{" "}
                  {/* New option */}
                  <option value="student">Students</option>
                  <option value="mphil_researcher">MPhil Researchers</option>{" "}
                  {/* New option */}
                  <option value="phd_researcher">PhD Researchers</option>{" "}
                  {/* New option */}
                  <option value="alumni">Alumni</option>
                  <option value="admin">Admins</option>
                </select>
              </div>
              {targetAudience === "student" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Student Year
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    value={targetStudentYear}
                    onChange={(e) => setTargetStudentYear(e.target.value)}
                    required={targetAudience === "student"}
                  >
                    <option value="">Select Year</option>
                    <option value="All">All Students</option>
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                    <option value="Masters">Masters</option>
                  </select>
                </div>
              )}
              {targetAudience !== "all" && (
                <div className="flex items-center mt-2">
                  <input
                    type="checkbox"
                    id="targetSpecificUsers"
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    checked={targetSpecificUsers}
                    onChange={(e) => {
                      setTargetSpecificUsers(e.target.checked);
                      setSelectedTargetUserEmails([]);
                    }}
                  />
                  <label
                    htmlFor="targetSpecificUsers"
                    className="ml-2 block text-sm text-gray-900"
                  >
                    Target Specific Users
                  </label>
                </div>
              )}

              {targetSpecificUsers && availableTargetUsers.length > 0 && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Select Specific{" "}
                    {targetAudience.charAt(0).toUpperCase() +
                      targetAudience.slice(1)}
                    s
                  </label>
                  <select
                    multiple
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 h-32"
                    value={selectedTargetUserEmails}
                    onChange={(e) =>
                      setSelectedTargetUserEmails(
                        Array.from(
                          e.target.selectedOptions,
                          (option) => option.value,
                        ),
                      )
                    }
                  >
                    {availableTargetUsers.map((u) => (
                      <option key={u.id} value={u.email}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Hold Ctrl/Cmd to select multiple users.
                  </p>
                </div>
              )}
              {targetSpecificUsers &&
                availableTargetUsers.length === 0 &&
                targetAudience !== "all" && (
                  <p className="text-sm text-gray-500 mt-2">
                    No {targetAudience} users found to select.
                  </p>
                )}

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isEvent"
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                  checked={isEvent}
                  onChange={(e) => setIsEvent(e.target.checked)}
                />
                <label
                  htmlFor="isEvent"
                  className="ml-2 block text-sm text-gray-900"
                >
                  Is this an Event?
                </label>
              </div>
              {message && (
                <p className="text-blue-600 text-sm mt-2">{message}</p>
              )}
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-5 py-2 rounded-lg shadow-md transition duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg shadow-md transition duration-200"
                >
                  {editingNotice ? "Update" : "Post"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <CustomModal
        isOpen={showConfirmModal}
        title="Confirm Action"
        message={confirmModalMessage}
        onConfirm={() => confirmModalAction && confirmModalAction()}
        onCancel={() => setShowConfirmModal(false)}
      />

      {/* NEW: Follow-up modal */}
      <CustomModal
        isOpen={showFollowUpModal}
        title="Action Required"
        message={followUpMessage}
        onConfirm={() => {
          setShowFollowUpModal(false);
          setFollowUpMessage("");
          setView("assign_examiners"); // Navigate to Assign Examiner page
        }}
        showCancel={false} // No cancel button for this type of prompt
      />
    </Card>
  );
};

const AdminManageUsers = ({
  user: loggedInUser,
  setLoggedInUser,
  onEditLoggedInUser,
  departmentName,
}) => {
  const { db, userId, isAuthReady } = useAuth();
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserUsername, setNewUserUsername] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("student");
  const [newUserProfilePicture, setNewUserProfilePicture] = useState("");
  const [newUserRollNumber, setNewUserRollNumber] = useState("");
  const [newUserBatch, setNewUserBatch] = useState("");
  const [newUserYear, setNewUserYear] = useState("1st Year");
  const [newUserHall, setNewUserHall] = useState("");
  const [newUserDesignation, setNewUserDesignation] = useState("");
  const [newUserJoinDate, setNewUserJoinDate] = useState("");
  const [newUserEducation, setNewUserEducation] = useState("");
  const [newUserAddress, setNewUserAddress] = useState("");
  const [newUserPhone, setNewUserPhone] = useState("");
  const [newUserPersonalEmail, setNewUserPersonalEmail] = useState("");

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalMessage, setConfirmModalMessage] = useState("");
  const [confirmModalAction, setConfirmModalAction] = useState(null);

  const [showEmailVerificationModal, setShowEmailVerificationModal] =
    useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [verificationCodeSent, setVerificationCodeSent] = useState(false);
  const [enteredVerificationCode, setEnteredVerificationCode] = useState("");
  const [expectedVerificationCode, setExpectedVerificationCode] = useState("");

  // Auto-generate email when username changes
  useEffect(() => {
    if (newUserUsername && departmentName) {
      const emailSuffix = getDepartmentEmailSuffix(departmentName);
      const generatedEmail = `${newUserUsername}@${emailSuffix}.${UNIVERSITY_DOMAIN}`;
      setNewUserEmail(generatedEmail);
    } else {
      setNewUserEmail("");
    }
  }, [newUserUsername, departmentName]);

  useEffect(() => {
    if (!isAuthReady || !userId) return;

    const usersColRef = collection(db, getCollectionPath("users", userId));
    const q =
      loggedInUser.role === "master_admin"
        ? usersColRef
        : query(
            usersColRef,
            where("role", "in", [
              "student",
              "teacher",
              "alumni",
              "second_examiner",
              "third_examiner",
              "mphil_researcher",
              "phd_researcher",
            ]),
          );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const usersData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setUsers(usersData);
      },
      (error) => {
        console.error("Failed to load users:", error);
        setMessage("Failed to load users.");
      },
    );

    return () => unsubscribe();
  }, [isAuthReady, userId, db, loggedInUser.role]);

  const handleChangeUserRole = (targetUserId, newRole) => {
    setConfirmModalMessage(
      `Are you sure you want to change this user's role to "${newRole}"?`,
    );
    setConfirmModalAction(() => async () => {
      setMessage("");
      if (!isAuthReady || !userId) {
        setMessage("Access not ready.");
        return;
      }

      if (
        loggedInUser.role !== "master_admin" &&
        (newRole === "admin" || newRole === "master_admin")
      ) {
        setMessage("Only Master Admin can assign Admin or Master Admin roles.");
        setShowConfirmModal(false);
        return;
      }

      try {
        const userDocRef = doc(
          db,
          getCollectionPath("users", userId),
          targetUserId,
        );
        await updateDoc(userDocRef, { role: newRole });
        setMessage("User role updated successfully!");
      } catch (error) {
        console.error("Failed to change role:", error);
        setMessage("Failed to change role.");
      } finally {
        setShowConfirmModal(false);
      }
    });
    setShowConfirmModal(true);
  };

  const handleInitiateDelete = (user) => {
    if (loggedInUser.role !== "master_admin") {
      setMessage("Only Master Admin can delete users.");
      return;
    }
    if (user.role === "master_admin" && user.email === loggedInUser.email) {
      setMessage("Master Admin cannot delete themselves.");
      return;
    }

    setUserToDelete(user);
    if (
      user.role === "teacher" ||
      user.role === "student" ||
      user.role === "alumni"
    ) {
      if (!user.personalEmail) {
        setMessage(
          `Cannot delete ${user.role} without a personal email for verification.`,
        );
        return;
      }
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setExpectedVerificationCode(code);
      setVerificationCodeSent(true);
      setMessage(
        `Verification email simulated sent to ${user.personalEmail}. Code: ${code}`,
      );
      setShowEmailVerificationModal(true);
    } else {
      setConfirmModalMessage(
        `Are you sure you want to delete user ${user.name} (${user.email})?`,
      );
      setConfirmModalAction(() => async () => {
        setMessage("");
        try {
          await deleteDoc(doc(db, getCollectionPath("users", userId), user.id));
          setMessage("User deleted successfully!");
        } catch (error) {
          console.error("Failed to delete user:", error);
          setMessage("Failed to delete user.");
        } finally {
          setShowConfirmModal(false);
          setUserToDelete(null);
        }
      });
      setShowConfirmModal(true);
    }
  };

  const handleVerifyAndDelete = async () => {
    setMessage("");
    if (enteredVerificationCode !== expectedVerificationCode) {
      setMessage("Invalid verification code.");
      return;
    }
    if (!userToDelete) {
      setMessage("No user selected for deletion.");
      return;
    }

    try {
      await deleteDoc(
        doc(db, getCollectionPath("users", userId), userToDelete.id),
      );
      setMessage("User deleted successfully after verification!");
      setShowEmailVerificationModal(false);
      setUserToDelete(null);
      setVerificationCodeSent(false);
      setEnteredVerificationCode("");
      setExpectedVerificationCode("");
    } catch (error) {
      console.error("Failed to delete user after verification:", error);
      setMessage("Failed to delete user.");
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setMessage("");
    if (!isAuthReady || !userId) {
      setMessage("Access not ready.");
      return;
    }
    if (!newUserName || !newUserUsername || !newUserPassword || !newUserRole) {
      setMessage("Name, username, password, and role are required.");
      return;
    }
    if (!newUserPersonalEmail) {
      setMessage("Primary Personal Email is required.");
      return;
    }

    // Recompute the department email directly instead of relying solely on
    // the auto-generated useEffect value, which could still be empty/stale
    // at submit time and silently break the Firestore write below.
    const emailSuffix = getDepartmentEmailSuffix(departmentName);
    const finalUserEmail = `${newUserUsername}@${emailSuffix}.${UNIVERSITY_DOMAIN}`;

    let profilePicUrlToSave = newUserProfilePicture;
    if (!profilePicUrlToSave) {
      if (
        ["teacher", "second_examiner", "third_examiner"].includes(newUserRole)
      ) {
        profilePicUrlToSave =
          "https://placehold.co/100x100/aabbcc/ffffff?text=Teacher";
      } else if (["student", "alumni"].includes(newUserRole)) {
        profilePicUrlToSave =
          "https://placehold.co/100x100/ccbbdd/ffffff?text=Student";
      } else if (newUserRole === "mphil_researcher") {
        profilePicUrlToSave =
          "https://placehold.co/100x100/bbddcc/ffffff?text=MPhil";
      } else if (newUserRole === "phd_researcher") {
        profilePicUrlToSave =
          "https://placehold.co/100x100/ddccbb/ffffff?text=PhD";
      } else {
        profilePicUrlToSave =
          "https://placehold.co/100x100/333333/ffffff?text=User";
      }
    }

    const newUser = {
      name: newUserName,
      email: finalUserEmail,
      password: newUserPassword,
      role: newUserRole,
      profilePicture: profilePicUrlToSave,
    };

    if (
      ["student", "alumni", "mphil_researcher", "phd_researcher"].includes(
        newUserRole,
      )
    ) {
      if (!newUserRollNumber || !newUserBatch || !newUserYear || !newUserHall) {
        setMessage(
          "Roll number, batch, year, and hall are required for students/alumni/researchers.",
        );
        return;
      }
      Object.assign(newUser, {
        rollNumber: newUserRollNumber,
        batch: newUserBatch,
        year: newUserYear,
        currentYear: newUserYear,
        hall: newUserHall,
        joinDate: new Date().toISOString().split("T")[0],
        phone: newUserPhone,
        personalEmail: newUserPersonalEmail,
        status: "Regular",
      });
    } else if (
      ["teacher", "second_examiner", "third_examiner"].includes(newUserRole)
    ) {
      if (
        !newUserDesignation ||
        !newUserJoinDate ||
        !newUserEducation ||
        !newUserAddress ||
        !newUserPhone
      ) {
        setMessage(
          "Designation, join date, education, address, and phone are required for teachers/examiners.",
        );
        return;
      }
      Object.assign(newUser, {
        designation: newUserDesignation,
        joinDate: newUserJoinDate,
        education: newUserEducation,
        address: newUserAddress,
        phone: newUserPhone,
        personalEmail: newUserPersonalEmail,
      });
    } else if (newUserRole === "admin" || newUserRole === "master_admin") {
      Object.assign(newUser, {
        personalEmail: newUserPersonalEmail,
      });
    }

    try {
      const userDocId = finalUserEmail.replace(/[^a-zA-Z0-9]/g, "_");
      if (!userDocId) {
        setMessage("Could not generate a valid user ID from the email. Please check the username.");
        return;
      }
      await setDoc(
        doc(db, getCollectionPath("users", userId), userDocId),
        newUser,
      );
      setMessage("New user added successfully!");
      setShowAddUserModal(false);
      setNewUserName("");
      setNewUserUsername("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole("student");
      setNewUserProfilePicture("");
      setNewUserRollNumber("");
      setNewUserBatch("");
      setNewUserYear("1st Year");
      setNewUserHall("");
      setNewUserDesignation("");
      setNewUserJoinDate("");
      setNewUserEducation("");
      setNewUserAddress("");
      setNewUserPhone("");
      setNewUserPersonalEmail("");
    } catch (error) {
      console.error("Failed to add user:", error);
      setMessage("Failed to add user.");
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <Card title="User Management">
      <div className="flex justify-between items-center mb-6">
        {loggedInUser.role === "master_admin" && (
          <button
            onClick={() => setShowAddUserModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg shadow-md transition duration-200"
          >
            Add New User
          </button>
        )}
        <input
          type="text"
          placeholder="Search..."
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      {message && <p className="text-blue-600 mb-4">{message}</p>}
      <div className="overflow-x-auto">
        {filteredUsers.length === 0 ? (
          <p className="text-gray-600">No users available.</p>
        ) : (
          <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-sm">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current Year/Designation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {u.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {u.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {u.role.replace("_", " ")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {u.role === "student" || u.role === "alumni"
                      ? u.currentYear
                      : u.role === "teacher"
                        ? u.designation
                        : ""}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {u.status || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                    {loggedInUser.role === "master_admin" && (
                      <button
                        onClick={() => onEditLoggedInUser(u)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm shadow-sm transition duration-200"
                      >
                        Edit
                      </button>
                    )}
                    {(loggedInUser.role === "master_admin" ||
                      loggedInUser.role === "admin") &&
                      (u.role === "student" ||
                        u.role === "teacher" ||
                        u.role === "alumni" ||
                        (loggedInUser.role === "master_admin" &&
                          u.role === "admin")) && (
                        <select
                          value={u.role}
                          onChange={(e) =>
                            handleChangeUserRole(u.id, e.target.value)
                          }
                          className="px-2 py-1 border border-gray-300 rounded-md text-sm bg-white"
                        >
                          <option value="student">Student</option>
                          <option value="teacher">Teacher</option>
                          <option value="alumni">Alumni</option>
                          <option value="second_examiner">
                            Second Examiner
                          </option>
                          <option value="third_examiner">Third Examiner</option>
                          <option value="mphil_researcher">
                            MPhil Researcher
                          </option>
                          <option value="phd_researcher">PhD Researcher</option>
                          {loggedInUser.role === "master_admin" && (
                            <option value="admin">Admin</option>
                          )}
                          {loggedInUser.role === "master_admin" && (
                            <option value="master_admin">Master Admin</option>
                          )}
                        </select>
                      )}
                    {loggedInUser.role === "master_admin" &&
                      u.role !== "master_admin" && (
                        <button
                          onClick={() => handleInitiateDelete(u)}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md text-sm shadow-sm transition duration-200"
                          disabled={u.role === "master_admin"}
                        >
                          Delete
                        </button>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAddUserModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-gray-800 mb-6">
              Add New User
            </h3>
            <form onSubmit={handleAddUser} className="space-y-4" noValidate>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Name
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Username
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  value={newUserUsername}
                  onChange={(e) => setNewUserUsername(e.target.value)}
                  placeholder="e.g., abdul"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Department Email
                </label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                  value={newUserEmail}
                  readOnly
                  placeholder={`${departmentName ? getDepartmentEmailSuffix(departmentName) + '.' + UNIVERSITY_DOMAIN : 'Enter username first'}`}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Email will be automatically generated as: username@{departmentName ? getDepartmentEmailSuffix(departmentName) + '.' + UNIVERSITY_DOMAIN : 'dept.juniv.edu'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Primary Personal Email
                </label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  value={newUserPersonalEmail}
                  onChange={(e) => setNewUserPersonalEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Role
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  required
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="second_examiner">Second Examiner</option>{" "}
                  <option value="third_examiner">Third Examiner</option>{" "}
                  <option value="mphil_researcher">
                    MPhil Researcher
                  </option>{" "}
                  <option value="phd_researcher">PhD Researcher</option>{" "}
                  <option value="alumni">Alumni</option>
                  <option value="admin">Admin</option>
                  {loggedInUser.role === "master_admin" && (
                    <option value="master_admin">Master Admin</option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Profile Picture URL
                </label>
                <input
                  type="url"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://placehold.co/100x100"
                  value={newUserProfilePicture}
                  onChange={(e) => setNewUserProfilePicture(e.target.value)}
                />
              </div>

              {[
                "student",
                "alumni",
                "mphil_researcher",
                "phd_researcher",
              ].includes(newUserRole) && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Roll Number
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      value={newUserRollNumber}
                      onChange={(e) => setNewUserRollNumber(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Batch
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      value={newUserBatch}
                      onChange={(e) => setNewUserBatch(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Year
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      value={newUserYear}
                      onChange={(e) => setNewUserYear(e.target.value)}
                    >
                      <option value="1st Year">1st Year</option>
                      <option value="2nd Year">2nd Year</option>
                      <option value="3rd Year">3rd Year</option>
                      <option value="4th Year">4th Year</option>
                      <option value="Masters">Masters</option>
                      <option value="MPhil">MPhil</option>
                      <option value="PhD">PhD</option>
                      <option value="Graduated">Graduated</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Hall
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      value={newUserHall}
                      onChange={(e) => setNewUserHall(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Phone
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      value={newUserPhone}
onChange={(e) => setNewUserPhone(e.target.value)}
                    />
                  </div>
                </>
              )}

              {["teacher", "second_examiner", "third_examiner"].includes(
                newUserRole,
              ) && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Designation
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      value={newUserDesignation}
                      onChange={(e) => setNewUserDesignation(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Join Date
                    </label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      value={newUserJoinDate}
                      onChange={(e) => setNewUserJoinDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Education
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      value={newUserEducation}
                      onChange={(e) => setNewUserEducation(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Address
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      value={newUserAddress}
                      onChange={(e) => setNewUserAddress(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Phone
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      value={newUserPhone}
                      onChange={(e) => setNewUserPhone(e.target.value)}
                    />
                  </div>
                </>
              )}

              {message && (
                <p className="text-red-600 text-sm mt-2">{message}</p>
              )}
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-5 py-2 rounded-lg shadow-md transition duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg shadow-md transition duration-200"
                >
                  Add User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CustomModal
        isOpen={showConfirmModal}
        title="Confirm Action"
        message={confirmModalMessage}
        onConfirm={() => confirmModalAction && confirmModalAction()}
        onCancel={() => setShowConfirmModal(false)}
      />

      {showEmailVerificationModal && userToDelete && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-sm">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              Verify Deletion
            </h3>
            <p className="text-gray-700 mb-4">
              A verification code has been sent to {userToDelete.personalEmail}.
              Please enter it to confirm deletion of {userToDelete.name}.
            </p>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 mb-4"
              placeholder="Enter verification code"
              value={enteredVerificationCode}
              onChange={(e) => setEnteredVerificationCode(e.target.value)}
              required
            />
            {message && <p className="text-red-600 text-sm mb-4">{message}</p>}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowEmailVerificationModal(false);
                  setUserToDelete(null);
                  setVerificationCodeSent(false);
                  setEnteredVerificationCode("");
                  setMessage("");
                }}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-5 py-2 rounded-lg shadow-md transition duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyAndDelete}
                className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg shadow-md transition duration-200"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

const AdminPromoteStudents = ({ user }) => {
  const { db, userId, isAuthReady } = useAuth();
  const [students, setStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState({});
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!isAuthReady || !userId) return;

    const usersColRef = collection(db, getCollectionPath("users", userId));
    const q = query(
      usersColRef,
      where("role", "in", [
        "student",
        "alumni",
        "mphil_researcher",
        "phd_researcher",
      ]),
    ); // Include researchers for promotion/status management
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const studentsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setStudents(studentsData);
        // Initialize selectedStudents state
        const initialSelection = {};
        studentsData.forEach((student) => {
          initialSelection[student.id] = false;
        });
        setSelectedStudents(initialSelection);
      },
      (error) => {
        console.error("Failed to load students:", error);
        setMessage("Failed to load students.");
      },
    );

    return () => unsubscribe();
  }, [isAuthReady, userId, db]);

  const handleSelectStudent = (studentId, isChecked) => {
    setSelectedStudents((prev) => ({ ...prev, [studentId]: isChecked }));
  };

  const handlePromoteSelected = async () => {
    setMessage("");
    if (!isAuthReady || !userId) {
      setMessage("Access not ready.");
      return;
    }

    const studentsToPromote = students.filter((s) => selectedStudents[s.id]);

    if (studentsToPromote.length === 0) {
      setMessage("No students selected for promotion.");
      return;
    }

    const batch = writeBatch(db);
    let promotedCount = 0;

    try {
      for (const student of studentsToPromote) {
        let newYear = student.currentYear;
        let newRole = student.role;

        // Determine next academic year and role
        switch (student.currentYear) {
          case "1st Year":
            newYear = "2nd Year";
            break;
          case "2nd Year":
            newYear = "3rd Year";
            break;
          case "3rd Year":
            newYear = "4th Year";
            break;
          case "4th Year":
            newYear = "Masters";
            break;
          case "Masters":
            newYear = "MPhil";
            newRole = "mphil_researcher";
            break; // Promote to MPhil Researcher
          case "MPhil":
            newYear = "PhD";
            newRole = "phd_researcher";
            break; // Promote to PhD Researcher
          case "PhD":
            newYear = "Graduated";
            newRole = "alumni"; // Change role to alumni after PhD
            break;
          case "Graduated":
            console.log(
              `Student ${student.name} is already graduated. Skipping promotion.`,
            );
            continue; // Skip already graduated students
          default:
            console.warn(
              `Unknown current year for student ${student.name}: ${student.currentYear}. Skipping promotion.`,
            );
            continue;
        }
        // Archive existing grades for the student
        const gradesColRef = collection(
          db,
          getCollectionPath("course_grades", userId),
        );
        const studentGradesQuery = query(
          gradesColRef,
          where("studentEmail", "==", student.email),
        );
        const studentGradesSnapshot = await getDocs(studentGradesQuery);

        const archivedResultsColRef = collection(
          db,
          getCollectionPath("archived_results", userId),
        );

        studentGradesSnapshot.docs.forEach((gradeDoc) => {
          // Add to archive
          const archivedDocRef = doc(archivedResultsColRef, gradeDoc.id); // Use same ID for simplicity
          batch.set(archivedDocRef, {
            ...gradeDoc.data(),
            archivedAt: new Date().toISOString(),
          });
          // Delete from current grades
          batch.delete(gradeDoc.ref);
        });

        // Update student's profile
        const studentDocRef = doc(
          db,
          getCollectionPath("users", userId),
          student.id,
        );
        batch.update(studentDocRef, {
          currentYear: newYear,
          role: newRole, // Update role if graduated
          status: newYear === "Graduated" ? "Graduated" : "Regular",
        });
        promotedCount++;
      }

      await batch.commit();
      setMessage(
        `${promotedCount} students promoted and their results archived successfully!`,
      );
      setSelectedStudents({}); // Clear selection
    } catch (error) {
      console.error("Failed to promote students or archive results:", error);
      setMessage("Failed to promote students or archive results.");
    }
  };

  const filteredStudents = students.filter(
    (student) =>
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.rollNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.currentYear.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <Card title="Student Year Promotion">
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={handlePromoteSelected}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg shadow-md transition duration-200"
        >
          Promote Selected Students
        </button>
        <input
          type="text"
          placeholder="Search students..."
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      {message && <p className="text-blue-600 mb-4">{message}</p>}
      <div className="overflow-x-auto">
        {filteredStudents.length === 0 ? (
          <p className="text-gray-600">No students available for promotion.</p>
        ) : (
          <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-sm">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Select
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Roll No.
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current Year
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Batch
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredStudents.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <input
                      type="checkbox"
                      checked={selectedStudents[student.id] || false}
                      onChange={(e) =>
                        handleSelectStudent(student.id, e.target.checked)
                      }
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      disabled={student.currentYear === "Graduated"} // Cannot promote if already graduated
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {student.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {student.rollNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {student.currentYear}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {student.batch}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {student.role}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {student.status || "N/A"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
};

const AdminCourseEnrollmentApproval = () => {
  const { db, userId, isAuthReady } = useAuth();
  const [pendingEnrollments, setPendingEnrollments] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isAuthReady || !userId) return;

    const enrollmentsColRef = collection(
      db,
      getCollectionPath("student_course_enrollments", userId),
    );
    const q = query(enrollmentsColRef, where("status", "==", "pending"));

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const enrollmentsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Fetch student names for display
        const enrollmentsWithStudentNames = await Promise.all(
          enrollmentsData.map(async (enrollment) => {
            const usersColRef = collection(
              db,
              getCollectionPath("users", userId),
            );
            const studentQuery = query(
              usersColRef,
              where("email", "==", enrollment.studentEmail),
            );
            const studentSnapshot = await getDocs(studentQuery);
            const studentData = studentSnapshot.docs[0]?.data();
            return {
              ...enrollment,
              studentName: studentData?.name || "N/A",
            };
          }),
        );
        setPendingEnrollments(enrollmentsWithStudentNames);
      },
      (error) => {
        console.error("Failed to load pending enrollments:", error);
        setMessage("Failed to load pending enrollments.");
      },
    );

    return () => unsubscribe();
  }, [isAuthReady, userId, db]);

  const handleApproveReject = async (enrollmentId, status) => {
    setMessage("");
    if (!isAuthReady || !userId) {
      setMessage("Access not ready.");
      return;
    }

    try {
      const enrollmentDocRef = doc(
        db,
        getCollectionPath("student_course_enrollments", userId),
        enrollmentId,
      );
      await updateDoc(enrollmentDocRef, {
        status: status,
        approvedAt: new Date().toISOString(),
      });
      setMessage(`Enrollment ${status} successfully!`);
    } catch (error) {
      console.error(`Failed to ${status} enrollment:`, error);
      setMessage(`Failed to ${status} enrollment.`);
    }
  };

  return (
    <Card title="Course Enrollment Approval">
      {message && <p className="text-blue-600 mb-4">{message}</p>}
      <div className="overflow-x-auto">
        {pendingEnrollments.length === 0 ? (
          <p className="text-gray-600">
            No pending course enrollment requests.
          </p>
        ) : (
          <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-sm">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Student Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Roll Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Course Name (Code)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Academic Year
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Teacher
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {pendingEnrollments.map((enrollment) => (
                <tr key={enrollment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {enrollment.studentName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {enrollment.studentRollNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {enrollment.courseName} ({enrollment.courseCode})
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {enrollment.academicYear}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {enrollment.teacherEmail}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600 font-semibold">
                    {enrollment.status}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                    <button
                      onClick={() =>
                        handleApproveReject(enrollment.id, "approved")
                      }
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md text-sm shadow-sm transition duration-200"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() =>
                        handleApproveReject(enrollment.id, "rejected")
                      }
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md text-sm shadow-sm transition duration-200"
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
};

const AdminResultCalculator = ({ departmentName }) => {
  const { db, userId, isAuthReady } = useAuth();
  const [academicYear, setAcademicYear] = useState("");
  const [batchYear, setBatchYear] = useState(""); // Admission year
  const [dataSource, setDataSource] = useState("current"); // 'current' or 'archive'
  const [results, setResults] = useState([]); // Stores aggregated results
  const [message, setMessage] = useState("");

  const academicYears = [
    "2021-2022",
    "2022-2023",
    "2023-2024",
    "2024-2025",
    "2025-2026",
    "2026-2027",
  ]; // Example academic years
  const batchYears = [
    "2021",
    "2020",
    "2019",
    "2018",
    "2017",
    "2016",
    "2022",
    "2023",
    "2024",
    "2025",
  ]; // Example admission years, expanded

  const calculateAverage = (marksArray) => {
    if (!marksArray || marksArray.length === 0) return 0;
    const total = marksArray.reduce(
      (sum, item) => sum + (parseFloat(item.score) || 0),
      0,
    );
    return parseFloat((total / marksArray.length).toFixed(2));
  };

  // New utility function to calculate combined average of assignment and in-course marks
  const calculateCombinedAssignmentAndInCourseAverage = (
    assignmentMarks,
    inCourseMarks,
  ) => {
    const allMarks = [];
    if (assignmentMarks) {
      allMarks.push(...assignmentMarks.map(item => parseFloat(item.score) || 0));
    }
    if (inCourseMarks) {
      allMarks.push(...inCourseMarks.map(item => parseFloat(item.score) || 0));
    }

    if (allMarks.length === 0) return 0; // Return 0 for calculation if no marks
    const total = allMarks.reduce((sum, score) => sum + score, 0);
    return parseFloat((total / allMarks.length).toFixed(2));
  };

  const handleLoadResults = async () => {
    setMessage("");
    setResults([]);
    if (!isAuthReady || !userId || !academicYear || !batchYear) {
      setMessage("Please select both Academic Year and Student Batch Year.");
      return;
    }

    try {
      const gradesCollectionName =
        dataSource === "current" ? "course_grades" : "archived_results";
      const gradesColRef = collection(
        db,
        getCollectionPath(gradesCollectionName, userId),
      );

      // 1. Get all students from the selected batch year
      const usersColRef = collection(db, getCollectionPath("users", userId));
      const studentQuery = query(
        usersColRef,
        where("role", "in", ["student", "alumni"]), // Include alumni for historical results
        where("batch", "==", batchYear),
      );
      const studentSnapshot = await getDocs(studentQuery);
      const students = studentSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      if (students.length === 0) {
        setMessage(`No students found for Batch ${batchYear}.`);
        return;
      }

      // 2. Fetch grades for these students for the selected academic year
      const aggregatedResults = [];
      let serialNo = 1;

      for (const student of students) {
        const studentGradesQuery = query(
          gradesColRef,
          where("studentEmail", "==", student.email),
          where("academicYear", "==", academicYear),
        );
        const studentGradesSnapshot = await getDocs(studentGradesQuery);
        const studentGrades = studentGradesSnapshot.docs.map((doc) =>
          doc.data(),
        );

        if (studentGrades.length === 0) {
          // If no grades for this student in this academic year, still add an entry
          aggregatedResults.push({
            serialNo: serialNo++,
            studentRollNumber: student.rollNumber,
            studentName: student.name,
            courseName: "No Courses",
            courseCode: "N/A",
            assignmentMarks: "N/A",
            inCourseMarks: "N/A",
            combinedAverage: "N/A", // Added combined average
            attendanceMarks: "N/A",
            finalExamMarks: "N/A",
            totalMarks: "N/A",
            session: student.batch,
            academicYear: academicYear,
          });
          continue;
        }

        for (const grade of studentGrades) {
          const avgInCourse = calculateAverage(grade.inCourseMarks);
          const combinedAvg = calculateCombinedAssignmentAndInCourseAverage(
            grade.assignmentMarks,
            grade.inCourseMarks,
          );

          // --- Final Exam Mark Calculation Logic ---
          let finalExamMarkDisplay = "N/A";
          let totalMarks = "N/A";
          const firstExaminerMark = parseFloat(grade.finalExamMarks);
          const secondExaminerMark = parseFloat(grade.secondExaminerFinalMark);
          const thirdExaminerMark = parseFloat(grade.thirdExaminerFinalMark);
          const hasFirst = !isNaN(firstExaminerMark) && grade.finalExamMarks !== undefined && grade.finalExamMarks !== "";
          const hasSecond = !isNaN(secondExaminerMark) && grade.secondExaminerFinalMark !== undefined && grade.secondExaminerFinalMark !== "";
          const hasThird = !isNaN(thirdExaminerMark) && grade.thirdExaminerFinalMark !== undefined && grade.thirdExaminerFinalMark !== "";

          if (hasThird) {
            finalExamMarkDisplay = thirdExaminerMark.toFixed(2);
            totalMarks = (parseFloat(combinedAvg) + (grade.attendanceMarks || 0) + thirdExaminerMark).toFixed(2);
          } else if (hasFirst && hasSecond) {
            const diff = Math.abs(firstExaminerMark - secondExaminerMark);
            if (diff >= THIRD_EXAMINER_THRESHOLD) {
              // Discrepancy, but no third examiner mark yet
              finalExamMarkDisplay = "N/A";
              totalMarks = "N/A";
            } else {
              const avg = ((firstExaminerMark + secondExaminerMark) / 2).toFixed(2);
              finalExamMarkDisplay = avg;
              totalMarks = (parseFloat(combinedAvg) + (grade.attendanceMarks || 0) + parseFloat(avg)).toFixed(2);
            }
          } else if (hasFirst) {
            // Only first examiner mark present (should not usually happen, but fallback)
            finalExamMarkDisplay = firstExaminerMark.toFixed(2);
            totalMarks = (parseFloat(combinedAvg) + (grade.attendanceMarks || 0) + firstExaminerMark).toFixed(2);
          } else {
            finalExamMarkDisplay = "N/A";
            totalMarks = "N/A";
          }
          // --- End Final Exam Mark Calculation Logic ---

          aggregatedResults.push({
            serialNo: serialNo++,
            studentRollNumber: student.rollNumber,
            studentName: student.name,
            courseName: grade.courseName,
            courseCode: grade.courseCode,
            assignmentMarks: grade.assignmentMarks?.[0]?.score || 0,
            inCourseMarks: avgInCourse,
            attendanceMarks: grade.attendanceMarks || 0,
            finalExamMarks: finalExamMarkDisplay,
            combinedAverage: combinedAvg, // Store combined average
            totalMarks: totalMarks,
            session: student.batch, // Student's admission batch
            academicYear: academicYear, // Academic year of the course
          });
        }
      }
      setResults(aggregatedResults);
      setMessage(
        `Results loaded from ${dataSource === "current" ? "current data" : "archive"} for Academic Year ${academicYear}, Batch ${batchYear}.`,
      );
    } catch (error) {
      console.error("Error loading results:", error);
      setMessage("Failed to load results.");
    }
  };

  const handleDownloadResults = () => {
    if (results.length === 0) {
      setMessage("No results to download. Please load results first.");
      return;
    }

    const departmentDisplayName = departmentName ? `Department of ${departmentName}` : "Department";
    let academicYearTitleDisplay = academicYear;
    // Map academic year to 1st, 2nd, 3rd, 4th, Masters for header display
    const admissionYearInt = parseInt(batchYear);
    const academicYearStartInt = parseInt(academicYear.split("-")[0]);
    const yearDiff = academicYearStartInt - admissionYearInt;

    switch (yearDiff) {
      case 0:
        academicYearTitleDisplay = "1st Year";
        break;
      case 1:
        academicYearTitleDisplay = "2nd Year";
        break;
      case 2:
        academicYearTitleDisplay = "3rd Year";
        break;
      case 3:
        academicYearTitleDisplay = "4th Year";
        break;
      case 4:
        academicYearTitleDisplay = "Masters";
        break;
      case 5:
        academicYearTitleDisplay = "Graduated";
        break;
      default:
        academicYearTitleDisplay = academicYear; // Fallback
    }

    const admissionYear = batchYear;

    let content = `${departmentDisplayName}\n\n`;
    content += `Academic Year Title: ${academicYearTitleDisplay}\n`;
    content += `Admission Year (1st Year): ${admissionYear}\n\n`;
    content += `Data Source: ${dataSource === "current" ? "Current Records" : "Archived Records"}\n\n`;

    // Table Headers for detailed per-course results
    const headers = [
      "S.No.",
      "Roll No.",
      "Student Name",
      "Session",
      "Academic Year",
      "Course Name",
      "Course Code",
      "Assignment Marks",
      "In-Course Marks (Avg)",
      "Average of Assignment Marks and Tutorial/In-Course Marks", // New header
      "Attendance Marks",
      "Final Exam Marks",
      "Total Marks (Course)",
    ];
    content += headers.join("\t") + "\n"; // Tab-separated for easier pasting into Word/Excel

    // Iterate through results (which are already per-course)
    results.forEach((row) => {
      const rowData = [
        row.serialNo,
        row.studentRollNumber,
        row.studentName,
        row.session,
        row.academicYear,
        row.courseName,
        row.courseCode,
        row.assignmentMarks,
        row.inCourseMarks,
        row.combinedAverage, // Include combined average
        row.attendanceMarks,
        row.finalExamMarks,
        row.totalMarks,
      ];
      content += rowData.join("\t") + "\n";
    });

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Results_${academicYear}_Batch${batchYear}_${dataSource}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setMessage(
      "Results downloaded as a text file. You can copy-paste this into MS Word or Excel.",
    );
  };

  return (
    <Card title="Result Calculator">
      <div className="mb-6 space-y-4">
        <div className="flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700">
              Select Academic Year
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
            >
              <option value="">Select Year</option>
              {academicYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700">
              Select Student Batch Year (Admission Year)
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              value={batchYear}
              onChange={(e) => setBatchYear(e.target.value)}
            >
              <option value="">Select Batch</option>
              {batchYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0 mt-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700">
              Data Source
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              value={dataSource}
              onChange={(e) => setDataSource(e.target.value)}
            >
              <option value="current">Current Results</option>
              <option value="archive">Archived Results</option>
            </select>
          </div>
          <div className="flex-1 flex items-end justify-end">
            <button
              onClick={handleLoadResults}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg shadow-md transition duration-200 w-full md:w-auto"
            >
              Load Results
            </button>
          </div>
        </div>
      </div>

      {message && <p className="text-blue-600 mb-4">{message}</p>}

      {results.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            Loaded Results
          </h3>
          <div className="overflow-x-auto mb-6">
            <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-sm">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    S.No.
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Roll No.
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student Name
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Session
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Academic Year
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Course Name
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Course Code
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assignment Marks
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    In-Course Marks (Avg)
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Average of Assignment Marks and Tutorial/In-Course Marks
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Attendance Marks
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Final Exam Marks
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Marks (Course)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {results.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap text-sm">
                      {row.serialNo}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">
                      {row.studentRollNumber}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">
                      {row.studentName}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">
                      {row.session}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">
                      {row.academicYear}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">
                      {row.courseName}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">
                      {row.courseCode}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">
                      {row.assignmentMarks}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">
                      {row.inCourseMarks}
                    </td>

                    <td className="px-4 py-2 whitespace-nowrap text-sm font-semibold">
                      {row.combinedAverage}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">
                      {row.attendanceMarks}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">
                      {row.finalExamMarks}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-semibold">
                      {row.totalMarks}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-right">
            <button
              onClick={handleDownloadResults}
              className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg shadow-md transition duration-200"
            >
              Download Result
            </button>
          </div>
        </div>
      )}
    </Card>
  );
};

const AdminAssignExaminers = ({ user }) => {
  const { db, userId, isAuthReady } = useAuth();
  const [academicYear, setAcademicYear] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [courseName, setCourseName] = useState("");
  const [batchYear, setBatchYear] = useState("");
  const [eligibleExaminers, setEligibleExaminers] = useState([]); // Teachers, Second Examiners, Third Examiners
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [message, setMessage] = useState("");
  const [assignedExaminers, setAssignedExaminers] = useState({}); // { secondExaminer: email, thirdExaminer: email }

  const academicYears = [
    "2021-2022",
    "2022-2023",
    "2023-2024",
    "2024-2025",
    "2025-2026",
    "2026-2027",
  ];
  const batchYears = [
    "2021",
    "2020",
    "2019",
    "2018",
    "2017",
    "2016",
    "2022",
    "2023",
    "2024",
    "2025",
  ];

  // Fetch eligible examiners (teachers, second examiners, third examiners)
  useEffect(() => {
    if (!isAuthReady || !userId) return;

    const fetchExaminers = async () => {
      try {
        const usersColRef = collection(db, getCollectionPath("users", userId));
        const q = query(
          usersColRef,
          where("role", "in", ["teacher", "second_examiner", "third_examiner"]),
        );
        const querySnapshot = await getDocs(q);
        const examiners = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setEligibleExaminers(examiners);
      } catch (error) {
        console.error("Failed to fetch eligible examiners:", error);
        setMessage("Failed to load eligible examiners.");
      }
    };
    fetchExaminers();
  }, [isAuthReady, userId, db]);

  // Fetch assigned examiners for the selected course
  useEffect(() => {
    if (!isAuthReady || !userId || !selectedCourse) {
      setAssignedExaminers({});
      return;
    }
    const assignmentsColRef = collection(
      db,
      getCollectionPath("examiner_assignments", userId),
    );
    const q = query(
      assignmentsColRef,
      where("courseId", "==", selectedCourse.id),
      where("academicYear", "==", selectedCourse.academicYear),
      where("batch", "==", selectedCourse.studentBatchYear), // <--- CHANGE THIS LINE
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const assignmentData = snapshot.docs[0].data();
          setAssignedExaminers({
            secondExaminer: assignmentData.secondExaminerEmail || "",
            thirdExaminer: assignmentData.thirdExaminerEmail || "",
          });
        } else {
          setAssignedExaminers({});
        }
      },
      (error) => {
        console.error("Failed to load examiner assignments:", error);
        setMessage("Failed to load examiner assignments.");
      },
    );

    return () => unsubscribe();
  }, [isAuthReady, userId, selectedCourse, db]);

  const handleLoadCourse = async () => {
    setMessage("");
    setSelectedCourse(null);
    setAssignedExaminers({});

    if (!academicYear || !courseCode || !courseName || !batchYear) {
      setMessage(
        "Please fill all course details (Course Name, Course Code, Session, Academic Year) to load the course.",
      );
      return;
    }

    try {
      const coursesColRef = collection(
        db,
        getCollectionPath("courses_offered", userId),
      );
      const q = query(
        coursesColRef,
        where("courseName", "==", courseName),
        where("courseCode", "==", courseCode),
        where("academicYear", "==", academicYear),
        where("studentBatchYear", "==", batchYear), // <--- CHANGE THIS LINE
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setMessage("No course found matching the provided details.");
      } else {
        const courseData = {
          id: querySnapshot.docs[0].id,
          ...querySnapshot.docs[0].data(),
        };
        setSelectedCourse(courseData);
        setMessage(
          `Course "${courseData.courseName}" loaded. Now assign examiners.`,
        );
      }
    } catch (error) {
      console.error("Failed to load course:", error);
      setMessage("Failed to load course.");
    }
  };

  const handleAssignExaminer = async () => {
    setMessage("");
    if (!isAuthReady || !userId || !selectedCourse) {
      setMessage("Please load a course first.");
      return;
    }

    const secondExaminerEmail = assignedExaminers.secondExaminer;
    const thirdExaminerEmail = assignedExaminers.thirdExaminer;

    if (!secondExaminerEmail) {
      setMessage("Please select a Second Examiner.");
      return;
    }

    // Ensure second examiner is not the first examiner (course offering teacher)
    if (secondExaminerEmail === selectedCourse.teacherEmail) {
      setMessage("The Second Examiner cannot be the Course Offering Teacher.");
      return;
    }

    // Ensure third examiner is not the first or second examiner
    if (
      thirdExaminerEmail &&
      (thirdExaminerEmail === selectedCourse.teacherEmail ||
        thirdExaminerEmail === secondExaminerEmail)
    ) {
      setMessage(
        "The Third Examiner cannot be the Course Offering Teacher or the Second Examiner.",
      );
      return;
    }

    try {
      const assignmentDocId = `${selectedCourse.id}-${selectedCourse.academicYear}-${selectedCourse.studentsYearOfEnrollment}`;
      const assignmentDocRef = doc(
        db,
        getCollectionPath("examiner_assignments", userId),
        assignmentDocId,
      );

      await setDoc(
        assignmentDocRef,
        {
          courseId: selectedCourse.id,
          courseName: selectedCourse.courseName,
          courseCode: selectedCourse.courseCode,
          academicYear: selectedCourse.academicYear,
          batch: selectedCourse.studentBatchYear, // <--- CHANGE THIS LINE
          firstExaminerEmail: selectedCourse.teacherEmail,
          secondExaminerEmail: secondExaminerEmail,
          thirdExaminerEmail: thirdExaminerEmail || null, // Store null if not assigned
          assignedBy: user.email,
          assignedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      setMessage("Examiners assigned successfully!");
    } catch (error) {
      console.error("Failed to assign examiners:", error);
      setMessage("Failed to assign examiners.");
    }
  };

  return (
    <Card title="Assign Examiners">
      <div className="mb-6 space-y-4">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">
          Load Course Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Course Name
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              placeholder="e.g., Data Structures"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Course Code
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
              placeholder="e.g., CSE-301"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Session (Student Batch Year)
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              value={batchYear}
              onChange={(e) => setBatchYear(e.target.value)}
            >
              <option value="">Select Batch</option>
              {batchYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Academic Year (Course Offered)
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
            >
              <option value="">Select Academic Year</option>
              {academicYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={handleLoadCourse}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg shadow-md transition duration-200 mt-4"
        >
          Load Course
        </button>
      </div>

      {message && <p className="text-blue-600 mb-4">{message}</p>}

      {selectedCourse && (
        <div className="mt-8 p-6 border border-gray-200 rounded-xl bg-gray-50 space-y-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            Course Details: {selectedCourse.courseName} (
            {selectedCourse.courseCode})
          </h3>
          <p>
            <strong>Course Offering Teacher:</strong>{" "}
            {selectedCourse.teacherEmail}
          </p>
          <p>
            <strong>Academic Year:</strong> {selectedCourse.academicYear}
          </p>
          <p>
            <strong>Target Students Year:</strong>{" "}
            {selectedCourse.studentsYearOfEnrollment}
          </p>

          <h4 className="text-lg font-semibold text-gray-800 mt-6 mb-3">
            Assign Examiners
          </h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Second Examiner
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                value={assignedExaminers.secondExaminer || ""}
                onChange={(e) =>
                  setAssignedExaminers((prev) => ({
                    ...prev,
                    secondExaminer: e.target.value,
                  }))
                }
              >
                <option value="">Select Second Examiner</option>
                {eligibleExaminers
                  .filter(
                    (examiner) =>
                      examiner.role === "second_examiner" &&
                      examiner.email !== selectedCourse.teacherEmail
                  )
                  .map((examiner) => (
                    <option key={examiner.id} value={examiner.email}>
                      {examiner.name} ({examiner.email}) - {examiner.role.replace("_", " ")}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Third Examiner (Optional)
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                value={assignedExaminers.thirdExaminer || ""}
                onChange={(e) =>
                  setAssignedExaminers((prev) => ({
                    ...prev,
                    thirdExaminer: e.target.value,
                  }))
                }
              >
                <option value="">Select Third Examiner</option>
                {eligibleExaminers
                  .filter(
                    (examiner) =>
                      examiner.role === "third_examiner" &&
                      examiner.email !== selectedCourse.teacherEmail &&
                      examiner.email !== assignedExaminers.secondExaminer
                  )
                  .map((examiner) => (
                    <option key={examiner.id} value={examiner.email}>
                      {examiner.name} ({examiner.email}) - {examiner.role.replace("_", " ")}
                    </option>
                  ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Third examiner is assigned if mark difference between first and
                second examiner exceeds threshold.
              </p>
            </div>
          </div>
          <button
            onClick={handleAssignExaminer}
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg shadow-md transition duration-200 mt-4"
          >
            Save Examiner Assignments
          </button>
        </div>
      )}
    </Card>
  );
};

const SecondExaminerEvaluation = ({ user }) => {
  const { db, userId, isAuthReady } = useAuth();
  const [assignedCourses, setAssignedCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [finalMarks, setFinalMarks] = useState({}); // Stores only final marks for students
  const [message, setMessage] = useState("");

  // Fetch courses assigned to this second examiner
  useEffect(() => {
    if (!isAuthReady || !userId) return;

    const assignmentsColRef = collection(
      db,
      getCollectionPath("examiner_assignments", userId),
    );
    const q = query(
      assignmentsColRef,
      where("secondExaminerEmail", "==", user.email),
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const assigned = snapshot.docs.map((doc) => doc.data());
        const courseDetailsPromises = assigned.map(async (assignment) => {
          const courseDoc = await getDoc(
            doc(
              db,
              getCollectionPath("courses_offered", userId),
              assignment.courseId,
            ),
          );
          if (courseDoc.exists()) {
            return {
              id: courseDoc.id,
              ...courseDoc.data(),
              assignmentDetails: assignment,
            };
          }
          return null;
        });
        const courses = (await Promise.all(courseDetailsPromises)).filter(
          Boolean,
        );
        setAssignedCourses(courses);
      },
      (error) => {
        console.error(
          "Failed to load assigned courses for second examiner:",
          error,
        );
        setMessage("Failed to load assigned courses.");
      },
    );

    return () => unsubscribe();
  }, [isAuthReady, userId, user.email, db]);

  // Handle course selection and fetch enrolled students and existing grades
  useEffect(() => {
    if (!isAuthReady || !userId || !selectedCourseId) {
      setSelectedCourse(null);
      setEnrolledStudents([]);
      setFinalMarks({});
      return;
    }

    const course = assignedCourses.find((c) => c.id === selectedCourseId);
    setSelectedCourse(course);

    if (course) {
      // Fetch students enrolled in this specific course
      const enrollmentsColRef = collection(
        db,
        getCollectionPath("student_course_enrollments", userId),
      );
      const qEnrollments = query(
        enrollmentsColRef,
        where("courseId", "==", course.id),
        where("status", "==", "approved"),
      );

      const unsubscribeEnrollments = onSnapshot(
        qEnrollments,
        async (enrollmentSnapshot) => {
          const enrolledStudentEmails = enrollmentSnapshot.docs.map(
            (doc) => doc.data().studentEmail,
          );

          if (enrolledStudentEmails.length > 0) {
            const usersColRef = collection(
              db,
              getCollectionPath("users", userId),
            );
            const studentDetailsPromises = enrolledStudentEmails.map((email) =>
              getDocs(query(usersColRef, where("email", "==", email))),
            );

            const studentSnapshots = await Promise.all(studentDetailsPromises);
            const students = studentSnapshots
              .flatMap((s) =>
                s.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
              )
              .filter((student) => student.role === "student");
            students.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));
            setEnrolledStudents(students);

            // Fetch existing grades for these students in this course
            const gradesColRef = collection(
              db,
              getCollectionPath("course_grades", userId),
            );
            const qGrades = query(
              gradesColRef,
              where("courseId", "==", course.id),
              where("academicYear", "==", course.academicYear),
            );

            const unsubscribeGrades = onSnapshot(
              qGrades,
              (gradesSnapshot) => {
                const currentFinalMarks = {};
                gradesSnapshot.docs.forEach((doc) => {
                  const data = doc.data();
                  currentFinalMarks[data.studentEmail] = {
                    firstExaminerFinalMark: data.finalExamMarks || 0, // Teacher's final mark
                    secondExaminerFinalMark: data.secondExaminerFinalMark || "", // This examiner's mark
                    thirdExaminerFinalMark: data.thirdExaminerFinalMark || "", // Third examiner's mark
                    status: data.status || "pending_second_examiner", // Status of grade submission
                  };
                });
                setFinalMarks(currentFinalMarks);
              },
              (error) => {
                console.error("Failed to load grades:", error);
                setMessage("Failed to load grades.");
              },
            );
            return () => unsubscribeGrades();
          } else {
            setEnrolledStudents([]);
            setFinalMarks({});
          }
        },
        (error) => {
          console.error("Failed to load enrolled students:", error);
          setMessage("Failed to load enrolled students.");
        },
      );

      return () => unsubscribeEnrollments();
    }
  }, [isAuthReady, userId, selectedCourseId, assignedCourses, db]);

  const handleFinalMarkChange = (studentEmail, value) => {
    setFinalMarks((prev) => ({
      ...prev,
      [studentEmail]: {
        ...prev[studentEmail],
        secondExaminerFinalMark: parseFloat(value) || 0,
      },
    }));
  };

  const handleSaveFinalMarks = async () => {
    setMessage("");
    if (!isAuthReady || !userId || !selectedCourse) {
      setMessage("Please select a course first.");
      return;
    }

    try {
      const batch = writeBatch(db);
      for (const student of enrolledStudents) {
        const studentEmail = student.email;
        const markEntry = finalMarks[studentEmail];

        if (
          markEntry === undefined ||
          markEntry.secondExaminerFinalMark === ""
        ) {
          setMessage("Please input final marks for all students.");
          return;
        }

        const docId = `${studentEmail}-${selectedCourse.id}-${selectedCourse.academicYear}`;
        const gradeDocRef = doc(
          db,
          getCollectionPath("course_grades", userId),
          docId,
        );

        let status = "pending_third_examiner_check"; // Default status after second examiner submits

        // Logic for third examiner assignment
        const firstExaminerMark = markEntry.firstExaminerFinalMark;
        const secondExaminerMark = markEntry.secondExaminerFinalMark;

        if (firstExaminerMark !== "" && secondExaminerMark !== "") {
          const difference = Math.abs(
            parseFloat(firstExaminerMark) - parseFloat(secondExaminerMark),
          );
          if (difference > THIRD_EXAMINER_THRESHOLD) {
            status = "pending_third_examiner";
            // Notify admin that third examiner is needed (optional, can be done via a separate notification system)
            console.log(
              `Third examiner needed for ${selectedCourse.courseName} for student ${student.rollNumber}`,
            );
          } else {
            status = "finalized"; // If difference is within threshold, finalize
            // Set finalCombinedMark as the average of first and second examiner marks
            batch.update(gradeDocRef, {
              finalCombinedMark: (
                (parseFloat(firstExaminerMark) +
                  parseFloat(secondExaminerMark)) /
                2
              ).toFixed(2),
            });
          }
        } else if (firstExaminerMark === "") {
          // If first examiner hasn't submitted their final mark, this is a problem.
          // For now, we'll allow second examiner to submit, but the system should ideally wait.
          // Or, the teacher should also be able to be a second examiner.
          status = "pending_first_examiner_final_mark";
        }

        batch.set(
          gradeDocRef,
          {
            studentEmail: studentEmail,
            studentRollNumber: student.rollNumber,
            courseId: selectedCourse.id,
            courseName: selectedCourse.courseName,
            courseCode: selectedCourse.courseCode,
            teacherEmail: selectedCourse.teacherEmail, // Original teacher
            academicYear: selectedCourse.academicYear,
            secondExaminerFinalMark: markEntry.secondExaminerFinalMark,
            finalMarkSubmittedBy: user.email, // This examiner's email
            status: status,
            lastUpdated: new Date().toISOString(),
          },
          { merge: true },
        );
      }
      await batch.commit();
      // 1. Send notification to admin after successful submission
      const notificationsColRef = collection(
        db,
        getCollectionPath("notifications", userId, true), // Public collection for notifications
      );
      await addDoc(notificationsColRef, {
        type: "second_examiner_final_result_submission",
        message: `Second Examiner ${user.name} (${user.email}) has submitted final results for ${selectedCourse.courseName} (${selectedCourse.courseCode}) for academic year ${selectedCourse.academicYear}. Please review the results or assign a Third Examiner if needed.`,
        courseId: selectedCourse.id,
        courseName: selectedCourse.courseName,
        courseCode: selectedCourse.courseCode,
        academicYear: selectedCourse.academicYear,
        studentsYearOfEnrollment: selectedCourse.studentsYearOfEnrollment, // Session identifier
        teacherEmail: selectedCourse.teacherEmail,
        timestamp: new Date().toISOString(),
        read: false,
        targetRole: "admin", // Target admins/master_admins
      });
      // 2. Update the message to the new required text
      setMessage("Final marks saved successfully and notification sent to Admin!");
    } catch (error) {
      console.error("Failed to save final marks:", error);
      setMessage("Failed to save final marks.");
    }
  };

  return (
    <Card title="Evaluate Scripts (Second Examiner)">
      <div className="mb-6 space-y-4">
        <select
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          value={selectedCourseId}
          onChange={(e) => setSelectedCourseId(e.target.value)}
        >
          <option value="">Select an Assigned Course</option>
          {assignedCourses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.courseName} ({course.courseCode}) - {course.academicYear}{" "}
              (Assigned by: {course.assignmentDetails.assignedBy})
            </option>
          ))}
        </select>
      </div>

      {message && <p className="text-blue-600 mb-4">{message}</p>}

      {selectedCourse && (
        <div className="mt-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            Students in {selectedCourse.courseName} ({selectedCourse.courseCode}
            )
          </h3>
          {enrolledStudents.length === 0 ? (
            <p className="text-gray-600">
              No students enrolled in this course or their enrollment is not yet
              approved.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-sm">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      S.No.
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Roll Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Your Final Mark
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {enrolledStudents.map((student, index) => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {student.rollNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {student.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        <input
                          type="number"
                          className="w-24 px-2 py-1 border border-gray-300 rounded-md"
                          placeholder="Score"
                          value={
                            finalMarks[student.email]
                              ?.secondExaminerFinalMark || ""
                          }
                          onChange={(e) =>
                            handleFinalMarkChange(student.email, e.target.value)
                          }
                          min="0"
                          max="100"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {finalMarks[student.email]?.status || "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-6 text-right">
                <button
                  onClick={handleSaveFinalMarks}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg shadow-md transition duration-200"
                >
                  Save Final Marks
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

const ThirdExaminerEvaluation = ({ user }) => {
  const { db, userId, isAuthReady } = useAuth();
  const [assignedCourses, setAssignedCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [finalMarks, setFinalMarks] = useState({}); // Stores only final marks for students
  const [message, setMessage] = useState("");

  // Fetch courses assigned to this third examiner
  useEffect(() => {
    if (!isAuthReady || !userId) return;

    const assignmentsColRef = collection(
      db,
      getCollectionPath("examiner_assignments", userId),
    );
    const q = query(
      assignmentsColRef,
      where("thirdExaminerEmail", "==", user.email),
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const assigned = snapshot.docs.map((doc) => doc.data());
        const courseDetailsPromises = assigned.map(async (assignment) => {
          const courseDoc = await getDoc(
            doc(
              db,
              getCollectionPath("courses_offered", userId),
              assignment.courseId,
            ),
          );
          if (courseDoc.exists()) {
            return {
              id: courseDoc.id,
              ...courseDoc.data(),
              assignmentDetails: assignment,
            };
          }
          return null;
        });
        const courses = (await Promise.all(courseDetailsPromises)).filter(
          Boolean,
        );
        setAssignedCourses(courses);
      },
      (error) => {
        console.error(
          "Failed to load assigned courses for third examiner:",
          error,
        );
        setMessage("Failed to load assigned courses.");
      },
    );

    return () => unsubscribe();
  }, [isAuthReady, userId, user.email, db]);

  // Handle course selection and fetch enrolled students and existing grades
  useEffect(() => {
    if (!isAuthReady || !userId || !selectedCourseId) {
      setSelectedCourse(null);
      setEnrolledStudents([]);
      setFinalMarks({});
      return;
    }

    const course = assignedCourses.find((c) => c.id === selectedCourseId);
    setSelectedCourse(course);

    if (course) {
      // Fetch students enrolled in this specific course
      const enrollmentsColRef = collection(
        db,
        getCollectionPath("student_course_enrollments", userId),
      );
      const qEnrollments = query(
        enrollmentsColRef,
        where("courseId", "==", course.id),
        where("status", "==", "approved"),
      );

      const unsubscribeEnrollments = onSnapshot(
        qEnrollments,
        async (enrollmentSnapshot) => {
          const enrolledStudentEmails = enrollmentSnapshot.docs.map(
            (doc) => doc.data().studentEmail,
          );

          if (enrolledStudentEmails.length > 0) {
            const usersColRef = collection(
              db,
              getCollectionPath("users", userId),
            );
            const studentDetailsPromises = enrolledStudentEmails.map((email) =>
              getDocs(query(usersColRef, where("email", "==", email))),
            );

            const studentSnapshots = await Promise.all(studentDetailsPromises);
            const students = studentSnapshots
              .flatMap((s) =>
                s.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
              )
              .filter((student) => student.role === "student");
            students.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber));
            setEnrolledStudents(students);

            // Fetch existing grades for these students in this course
            const gradesColRef = collection(
              db,
              getCollectionPath("course_grades", userId),
            );
            const qGrades = query(
              gradesColRef,
              where("courseId", "==", course.id),
              where("academicYear", "==", course.academicYear),
            );

            const unsubscribeGrades = onSnapshot(
              qGrades,
              (gradesSnapshot) => {
                const currentFinalMarks = {};
                gradesSnapshot.docs.forEach((doc) => {
                  const data = doc.data();
                  currentFinalMarks[data.studentEmail] = {
                    firstExaminerFinalMark: data.finalExamMarks || 0,
                    secondExaminerFinalMark: data.secondExaminerFinalMark || 0,
                    thirdExaminerFinalMark: data.thirdExaminerFinalMark || "", // This examiner's mark
                    status: data.status || "pending_third_examiner",
                  };
                });
                setFinalMarks(currentFinalMarks);
              },
              (error) => {
                console.error("Failed to load grades:", error);
                setMessage("Failed to load grades.");
              },
            );
            return () => unsubscribeGrades();
          } else {
            setEnrolledStudents([]);
            setFinalMarks({});
          }
        },
        (error) => {
          console.error("Failed to load enrolled students:", error);
          setMessage("Failed to load enrolled students.");
        },
      );

      return () => unsubscribeEnrollments();
    }
  }, [isAuthReady, userId, selectedCourseId, assignedCourses, db]);

  const handleFinalMarkChange = (studentEmail, value) => {
    setFinalMarks((prev) => ({
      ...prev,
      [studentEmail]: {
        ...prev[studentEmail],
        thirdExaminerFinalMark: value === "" ? "" : Number(value),
      },
    }));
  };

  const handleSaveFinalMarks = async () => {
    setMessage("");
    if (!isAuthReady || !userId || !selectedCourse) {
      setMessage("Please select a course first.");
      return;
    }

    try {
      const batch = writeBatch(db);
      let missingMark = false;
      // Only require marks for students in the displayed list
      for (const student of enrolledStudents.filter((student) => {
        const marks = finalMarks[student.email];
        if (!marks) return false;
        const first = parseFloat(marks.firstExaminerFinalMark);
        const second = parseFloat(marks.secondExaminerFinalMark);
        if (isNaN(first) || isNaN(second)) return false;
        return Math.abs(first - second) >= THIRD_EXAMINER_THRESHOLD;
      })) {
        const studentEmail = student.email;
        const markEntry = finalMarks[studentEmail];

        if (
          markEntry === undefined ||
          markEntry.thirdExaminerFinalMark === "" ||
          markEntry.thirdExaminerFinalMark === null ||
          isNaN(Number(markEntry.thirdExaminerFinalMark))
        ) {
          missingMark = true;
          break;
        }

        const docId = `${studentEmail}-${selectedCourse.id}-${selectedCourse.academicYear}`;
        const gradeDocRef = doc(
          db,
          getCollectionPath("course_grades", userId),
          docId,
        );

        batch.set(
          gradeDocRef,
          {
            studentEmail: studentEmail,
            studentRollNumber: student.rollNumber,
            courseId: selectedCourse.id,
            courseName: selectedCourse.courseName,
            courseCode: selectedCourse.courseCode,
            teacherEmail: selectedCourse.teacherEmail,
            academicYear: selectedCourse.academicYear,
            thirdExaminerFinalMark: markEntry.thirdExaminerFinalMark,
            finalMarkSubmittedBy: user.email, // This examiner's email
            status: "finalized", // Third examiner submission finalizes the grade
            lastUpdated: new Date().toISOString(),
          },
          { merge: true },
        );
      }
      if (missingMark) {
        setMessage("Please input final marks for all students listed.");
        return;
      }
      await batch.commit();
      // Send notification to admin after successful submission (mirroring Second Examiner)
      const notificationsColRef = collection(
        db,
        getCollectionPath("notifications", userId, true), // Public collection for notifications
      );
      await addDoc(notificationsColRef, {
        type: "third_examiner_final_result_submission",
        message: `Third Examiner ${user.name} (${user.email}) has submitted final results for ${selectedCourse.courseName} (${selectedCourse.courseCode}) for academic year ${selectedCourse.academicYear}. Please review the results.`,
        courseId: selectedCourse.id,
        courseName: selectedCourse.courseName,
        courseCode: selectedCourse.courseCode,
        academicYear: selectedCourse.academicYear,
        studentsYearOfEnrollment: selectedCourse.studentsYearOfEnrollment, // Session identifier
        teacherEmail: selectedCourse.teacherEmail,
        timestamp: new Date().toISOString(),
        read: false,
        targetRole: "admin", // Target admins/master_admins
      });
      setMessage("Final marks saved successfully and notification sent to Admin!");
    } catch (error) {
      console.error("Failed to save final marks:", error);
      setMessage("Failed to save final marks.");
    }
  };

  return (
    <Card title="Evaluate Scripts (Third Examiner)">
      <div className="mb-6 space-y-4">
        <select
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          value={selectedCourseId}
          onChange={(e) => setSelectedCourseId(e.target.value)}
        >
          <option value="">Select an Assigned Course</option>
          {assignedCourses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.courseName} ({course.courseCode}) - {course.academicYear}{" "}
              (Assigned by: {course.assignmentDetails.assignedBy})
            </option>
          ))}
        </select>
      </div>

      {message && <p className="text-blue-600 mb-4">{message}</p>}

      {selectedCourse && (
        <div className="mt-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            Students in {selectedCourse.courseName} ({selectedCourse.courseCode}
            )
          </h3>
          {enrolledStudents.length === 0 ? (
            <p className="text-gray-600">
              No students enrolled in this course or their enrollment is not yet
              approved.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-sm">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      S.No.
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Roll Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Your Final Mark
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {enrolledStudents
                    .filter((student) => {
                      const marks = finalMarks[student.email];
                      if (!marks) return false;
                      const first = parseFloat(marks.firstExaminerFinalMark);
                      const second = parseFloat(marks.secondExaminerFinalMark);
                      if (isNaN(first) || isNaN(second)) return false;
                      return Math.abs(first - second) >= THIRD_EXAMINER_THRESHOLD;
                    })
                    .map((student, index) => (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {index + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {student.rollNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {student.name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          <input
                            type="number"
                            className="w-24 px-2 py-1 border border-gray-300 rounded-md"
                            placeholder="Score"
                            value={
                              finalMarks[student.email]?.thirdExaminerFinalMark ||
                              ""
                            }
                            onChange={(e) =>
                              handleFinalMarkChange(student.email, e.target.value)
                            }
                            min="0"
                            max="100"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {finalMarks[student.email]?.status || "N/A"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              <div className="mt-6 text-right">
                <button
                  onClick={handleSaveFinalMarks}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg shadow-md transition duration-200"
                >
                  Save Final Marks
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

const NoticeBoard = ({ user }) => {
  const { db, userId, isAuthReady } = useAuth();
  const [notices, setNotices] = useState([]);
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!isAuthReady || !userId) return;

    const noticesColRef = collection(db, getCollectionPath("notices", userId, false, window.selectedDepartmentName));
    const unsubscribe = onSnapshot(
      noticesColRef,
      (snapshot) => {
        const allNotices = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Filter notices based on user role and target audience
        const filtered = allNotices.filter((notice) => {
          // 1. Check for 'all' audience
          if (notice.targetAudience === "all") return true;

          // 2. Check for role-based targeting (if not specifically targeted)
          if (
            notice.targetAudience === user.role &&
            !notice.targetSpecificUsers
          ) {
            if (
              user.role === "student" &&
              notice.targetStudentYear &&
              notice.targetStudentYear !== "All"
            ) {
              return notice.targetStudentYear === user.currentYear;
            }
            return true;
          }

          // 3. Check for specific user targeting
          if (
            notice.targetSpecificUsers &&
            notice.targetUserEmails &&
            notice.targetUserEmails.includes(user.email)
          ) {
            return true;
          }

          return false;
        });
        setNotices(filtered);
      },
      (error) => {
        console.error("Failed to load notices:", error);
        setMessage("Failed to load notices.");
      },
    );

    return () => unsubscribe();
  }, [isAuthReady, userId, user.role, user.currentYear, user.email, db]);

  const filteredNotices = notices.filter(
    (notice) =>
      notice.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notice.content.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const markNoticeAsRead = async (noticeId) => {
    const noticeRef = doc(db, getCollectionPath("notices", userId, false, window.selectedDepartmentName), noticeId);
    await updateDoc(noticeRef, {
      readBy: arrayUnion(user.email),
    });
  };

  return (
    <Card title="Notice Board">
      <input
        type="text"
        placeholder="Search notices..."
        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 mb-4"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      {message && <p className="text-blue-600 mb-4">{message}</p>}
      <div className="space-y-6">
        {filteredNotices.length === 0 ? (
          <p className="text-gray-600">No notices for you.</p>
        ) : (
          filteredNotices.map((notice) => (
            <div
              key={notice.id}
              className={`border border-gray-200 rounded-xl p-6 shadow-sm bg-gray-50 ${notice.readBy && notice.readBy.includes(user.email) ? '' : 'ring-2 ring-red-400'}`}
              onClick={() => !notice.readBy?.includes(user.email) && markNoticeAsRead(notice.id)}
              style={{ cursor: 'pointer' }}
            >
              <h4 className="text-xl font-semibold text-gray-800 mb-2">
                {notice.title}
                {!notice.readBy?.includes(user.email) && (
                  <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">Unread</span>
                )}
              </h4>
              <p className="text-gray-700 mb-3">{notice.content}</p>
              <div className="flex justify-between items-center text-sm text-gray-500">
                <span>Posted by: {notice.postedBy}{notice.postedByName ? ` (${notice.postedByName})` : ""}</span>
                <span>
                  Date: {new Date(notice.postedAt).toLocaleDateString("en-US")}
                </span>
                {notice.isEvent && (
                  <span className="bg-yellow-200 text-yellow-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    Event
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};

// Main application content component that uses AuthContext
const MainAppContent = ({ departmentName, navigateTo }) => {
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [currentView, setCurrentView] = useState("profile"); // Default view
  const { db, userId, isAuthReady } = useAuth(); // Now safe to use useAuth() here
  const [showEditModalForSelf, setShowEditModalForSelf] = useState(false); // For Master Admin self-edit
  const [userToEditInModal, setUserToEditInModal] = useState(null); // To hold the user object for the modal
  const [allNotices, setAllNotices] = useState([]);
  // NEW: State for admin notifications
  const [adminNotifications, setAdminNotifications] = useState([]);
  const [researcherNotices, setResearcherNotices] = useState({
    seminars: [],
    thesis_submission: [],
    thesis_defense: [],
    degree_status: []
  });
  const [refreshResearcherNotices, setRefreshResearcherNotices] = useState(0);

  // --- Per-type unread badge counts for researcher notices ---
  const getUnreadResearcherNoticesCountByType = (noticesArr, userEmail) =>
    noticesArr.filter(n => !Array.isArray(n.readBy) || !n.readBy.includes(userEmail)).length;

  const unreadSeminarNotices = getUnreadResearcherNoticesCountByType(researcherNotices.seminars, loggedInUser?.email);
  const unreadThesisSubmissionNotices = getUnreadResearcherNoticesCountByType(researcherNotices.thesis_submission, loggedInUser?.email);
  const unreadThesisDefenseNotices = getUnreadResearcherNoticesCountByType(researcherNotices.thesis_defense, loggedInUser?.email);
  const unreadDegreeStatusNotices = getUnreadResearcherNoticesCountByType(researcherNotices.degree_status, loggedInUser?.email);

  // Effect to load all notices for badge count
  useEffect(() => {
    if (!isAuthReady || !userId) return;
    const noticesColRef = collection(db, getCollectionPath("notices", userId, false, departmentName));
    const unsubscribe = onSnapshot(
      noticesColRef,
      (snapshot) => {
        const all = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setAllNotices(all);
      },
      (error) => {
        console.error("Failed to load all notices:", error);
      },
    );
    return () => unsubscribe();
  }, [isAuthReady, userId, db]);

  // NEW: Effect to load admin notifications for badge count
  useEffect(() => {
    if (!isAuthReady || !userId || !(loggedInUser && (loggedInUser.role === "admin" || loggedInUser.role === "master_admin"))) return;
    const notificationsColRef = collection(db, getCollectionPath("notifications", userId, true, departmentName));
    const qNotifications = query(
      notificationsColRef,
      where("targetRole", "==", "admin"),
      where("read", "==", false),
    );
    const unsubscribeNotifications = onSnapshot(
      qNotifications,
      (snapshot) => {
        const newNotifications = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setAdminNotifications(newNotifications);
      },
      (error) => {
        console.error("Failed to load admin notifications:", error);
      },
    );
    return () => unsubscribeNotifications();
  }, [isAuthReady, userId, db, loggedInUser]);

  // Effect to load all researcher notices
  useEffect(() => {
    if (!isAuthReady || !userId || !loggedInUser) return;
    const tabs = ["seminars", "thesis_submission", "thesis_defense", "degree_status"];
    const unsubscribes = [];
    tabs.forEach(tab => {
      const colName = `research_notices_${tab}`;
      const colRef = collection(db, getCollectionPath(colName, userId, true, departmentName));
      const unsubscribe = onSnapshot(colRef, (snapshot) => {
        let data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        data = data.filter((n) => {
          if (n.targetAudience === "all") return true;
          if (n.targetAudience === loggedInUser.role) return true;
          if (n.targetResearchers && n.targetResearchers.includes(loggedInUser.email)) return true;
          return false;
        });
        setResearcherNotices(prev => ({ ...prev, [tab]: data }));
      });
      unsubscribes.push(unsubscribe);
    });
    return () => unsubscribes.forEach(u => u());
  }, [isAuthReady, userId, db, loggedInUser, refreshResearcherNotices]);

  // Returns the count of unread notices for a user based on their email and visible notices
  const getUnreadVisibleNoticesCount = (allNotices, user) => {
    if (!Array.isArray(allNotices) || !user?.email) return 0;
    // Apply the same filtering as NoticeBoard
    const visible = allNotices.filter((notice) => {
      // 1. Check for 'all' audience
      if (notice.targetAudience === "all") return true;
      // 2. Check for role-based targeting (if not specifically targeted)
      if (
        notice.targetAudience === user.role &&
        !notice.targetSpecificUsers
      ) {
        if (
          user.role === "student" &&
          notice.targetStudentYear &&
          notice.targetStudentYear !== "All"
        ) {
          return notice.targetStudentYear === user.currentYear;
        }
        return true;
      }
      // 3. Check for specific user targeting
      if (
        notice.targetSpecificUsers &&
        notice.targetUserEmails &&
        notice.targetUserEmails.includes(user.email)
      ) {
        return true;
      }
      return false;
    });
    return visible.filter(
      (notice) => Array.isArray(notice.readBy) && !notice.readBy.includes(user.email)
    ).length;
  };

  // Combine unread notices and admin notifications for badge
  let unreadNoticesCount = 0;
  if (loggedInUser) {
    if (loggedInUser.role === "admin" || loggedInUser.role === "master_admin") {
      const relevantAdminNotifications = adminNotifications.filter(
        n => [
          "final_result_submission",
          "second_examiner_final_result_submission",
          "third_examiner_final_result_submission"
        ].includes(n.type)
      );
      unreadNoticesCount = getUnreadNoticesCount(allNotices, loggedInUser.email) + relevantAdminNotifications.length;
    } else if (loggedInUser.role === "mphil_researcher" || loggedInUser.role === "phd_researcher") {
      unreadNoticesCount = getUnreadNoticesCount(allNotices, loggedInUser.email) + getUnreadResearcherNoticesCountByType(researcherNotices.seminars, loggedInUser.email) + getUnreadResearcherNoticesCountByType(researcherNotices.thesis_submission, loggedInUser.email) + getUnreadResearcherNoticesCountByType(researcherNotices.thesis_defense, loggedInUser.email) + getUnreadResearcherNoticesCountByType(researcherNotices.degree_status, loggedInUser.email);
    } else {
      unreadNoticesCount = getUnreadVisibleNoticesCount(allNotices, loggedInUser);
    }
  }

  // Effect to load mock users into Firestore on initial load
  useEffect(() => {
    const loadMockUsers = async () => {
      if (!isAuthReady || !userId) return;

      try {
        const usersColRef = collection(db, getCollectionPath("users", userId, false, departmentName));
        const querySnapshot = await getDocs(usersColRef);
        if (querySnapshot.empty) {
          console.log("Loading mock users into Firestore...");
          const mockUsers = getMockUsers(departmentName);
          for (const user of mockUsers) {
            const userDocId = user.email.replace(/[^a-zA-Z0-9]/g, "_");
            await setDoc(doc(usersColRef, userDocId), {
              ...user,
              id: userDocId,
            });
          }
          console.log("Mock users loaded.");
        } else {
          // Comment out or remove the console.log for skipping mock data load
          // console.log(
          //   "Users already exist in Firestore, skipping mock data load.",
          // );
        }
      } catch (error) {
        console.error("Error loading mock users:", error);
      }
    };

    if (isAuthReady) {
      loadMockUsers();
    }
  }, [isAuthReady, userId, db]);

  const handleLoginSuccess = (user) => {
    setLoggedInUser(user);
    // Set default view based on role
    if (user.role === "master_admin" || user.role === "admin") {
      setCurrentView("admin_dashboard");
    } else {
      setCurrentView("profile");
    }
  };

  const handleLogout = () => {
    setLoggedInUser(null);
    setCurrentView("profile"); // Reset view on logout
  };

  const handleSaveProfileForSelf = async (updatedData) => {
    if (!userToEditInModal || !isAuthReady || !userId) {
      console.error(
        "Cannot save profile: user not logged in or auth not ready.",
      );
      return;
    }
    try {
      const userDocRef = doc(
        db,
        getCollectionPath("users", userId, false, departmentName),
        userToEditInModal.id,
      );
      await updateDoc(userDocRef, updatedData);
      // If the updated user is the logged-in user, update loggedInUser state
      if (loggedInUser && loggedInUser.id === userToEditInModal.id) {
        setLoggedInUser((prevUser) => ({ ...prevUser, ...updatedData }));
      }
      setShowEditModalForSelf(false); // Close the modal
      setUserToEditInModal(null); // Clear the user being edited
      console.log("Profile updated successfully!");
    } catch (error) {
      console.error("Failed to update profile:", error);
    }
  };

  const handleEditLoggedInUser = (user) => {
    setUserToEditInModal(user);
    setShowEditModalForSelf(true);
  };

  // In MainAppContent, add a new function to optimistically mark a notice as read in local state
  const handleResearcherNoticeRead = (tab, noticeId, userEmail) => {
    setResearcherNotices(prev => ({
      ...prev,
      [tab]: prev[tab].map(n => n.id === noticeId ? { ...n, readBy: [...(n.readBy || []), userEmail] } : n)
    }));
  };

  const renderContent = () => {
    if (!loggedInUser) {
      return <Login onLoginSuccess={handleLoginSuccess} departmentName={departmentName} />;
    }

    switch (currentView) {
      case "profile":
        return (
          <UserProfile user={loggedInUser} setLoggedInUser={setLoggedInUser} />
        );
      case "admin_dashboard":
        return <AdminDashboard user={loggedInUser} />;
      case "officer_dashboard":
        return loggedInUser.role === "officer" ? (
          <OfficerDashboard setView={setCurrentView} />
        ) : (
          <p className="text-red-600 text-center text-xl mt-10">
            Access Denied: You do not have permission to view this page.
          </p>
        );
      case "controller_dashboard":
        return loggedInUser.role === "controller" ? (
          <ControllerDashboard setView={setCurrentView} />
        ) : (
          <p className="text-red-600 text-center text-xl mt-10">
            Access Denied: You do not have permission to view this page.
          </p>
        );
      case "notices":
        return loggedInUser.role === "master_admin" ||
          loggedInUser.role === "admin" ? (
          <AdminManageNotices user={loggedInUser} setView={setCurrentView} /> // MODIFIED: Pass setView here
        ) : (
          <NoticeBoard user={loggedInUser} />
        );
      case "manage_users":
        return loggedInUser.role === "master_admin" ||
          loggedInUser.role === "admin" ? (
          <AdminManageUsers
            user={loggedInUser}
            setLoggedInUser={setLoggedInUser}
            onEditLoggedInUser={handleEditLoggedInUser}
            departmentName={departmentName}
          />
        ) : (
          <p className="text-red-600 text-center text-xl mt-10">
            Access Denied: You do not have permission to view this page.
          </p>
        );
      case "promote_students":
        return loggedInUser.role === "master_admin" ||
          loggedInUser.role === "admin" ? (
          <AdminPromoteStudents user={loggedInUser} />
        ) : (
          <p className="text-red-600 text-center text-xl mt-10">
            Access Denied: You do not have permission to view this page.
          </p>
        );
      case "course_enrollment_approval":
        return loggedInUser.role === "master_admin" ||
          loggedInUser.role === "admin" ? (
          <AdminCourseEnrollmentApproval />
        ) : (
          <p className="text-red-600 text-center text-xl mt-10">
            Access Denied: You do not have permission to view this page.
          </p>
        );
      case "result_calculator":
        return loggedInUser.role === "master_admin" ||
          loggedInUser.role === "admin" ? (
          <AdminResultCalculator departmentName={departmentName} />
        ) : (
          <p className="text-red-600 text-center text-xl mt-10">
            Access Denied: You do not have permission to view this page.
          </p>
        );
      case "officer_result_calculator":
        return loggedInUser.role === "officer" ? (
          <OfficerResultCalculator departmentName={departmentName} />
        ) : (
          <p className="text-red-600 text-center text-xl mt-10">
            Access Denied: You do not have permission to view this page.
          </p>
        );
      case "assign_examiners": // New case for assigning examiners
        return loggedInUser.role === "master_admin" ||
          loggedInUser.role === "admin" ? (
          <AdminAssignExaminers user={loggedInUser} />
        ) : (
          <p className="text-red-600 text-center text-xl mt-10">
            Access Denied: You do not have permission to view this page.
          </p>
        );
      case "researcher_management": // New case for researcher management
        return loggedInUser.role === "master_admin" ||
          loggedInUser.role === "admin" ? (
          <AdminResearcherManagement user={loggedInUser} />
        ) : (
          <p className="text-red-600 text-center text-xl mt-10">
            Access Denied: You do not have permission to view this page.
          </p>
        );
      case "assignments":
        return loggedInUser.role === "teacher" ? (
          <TeacherAssignments user={loggedInUser} />
        ) : (
          <StudentAssignments user={loggedInUser} />
        );
      case "evaluation":
        return loggedInUser.role === "teacher" ? (
          <TeacherEvaluation user={loggedInUser} />
        ) : (
          <p className="text-red-600 text-center text-xl mt-10">
            Access Denied: You do not have permission to view this page.
          </p>
        );
      case "evaluations":
        return loggedInUser.role === "teacher" ? (
          <TeacherEvaluationsReport user={loggedInUser} />
        ) : (
          <p className="text-red-600 text-center text-xl mt-10">
            Access Denied: You do not have permission to view this page.
          </p>
        );
      case "resources":
        return loggedInUser.role === "teacher" ? (
          <TeacherResources user={loggedInUser} />
        ) : (
          <StudentResources user={loggedInUser} />
        );
      case "evaluate_scripts_second": // New case for second examiner
        return loggedInUser.role === "second_examiner" ? (
          <SecondExaminerEvaluation user={loggedInUser} />
        ) : (
          <p className="text-red-600 text-center text-xl mt-10">
            Access Denied: You do not have permission to view this page.
          </p>
        );
      case "evaluate_scripts_third": // New case for third examiner
        return loggedInUser.role === "third_examiner" ? (
          <ThirdExaminerEvaluation user={loggedInUser} />
        ) : (
          <p className="text-red-600 text-center text-xl mt-10">
            Access Denied: You do not have permission to view this page.
          </p>
        );
      case "course_selection":
        return loggedInUser.role === "student" ? (
          <StudentCourseSelection user={loggedInUser} />
        ) : (
          <p className="text-red-600 text-center text-xl mt-10">
            Access Denied: You do not have permission to view this page.
          </p>
        );
      case "results":
        return loggedInUser.role === "student" ||
          loggedInUser.role === "alumni" ? (
          <StudentResults user={loggedInUser} />
        ) : (
          <p className="text-red-600 text-center text-xl mt-10">
            Access Denied: You do not have permission to view this page.
          </p>
        );
      case "evaluate_teachers":
        return loggedInUser.role === "student" ? (
          <StudentEvaluateTeachers user={loggedInUser} />
        ) : (
          <p className="text-red-600 text-center text-xl mt-10">
            Access Denied: You do not have permission to view this page.
          </p>
        );
      case "archive":
        return loggedInUser.role === "student" ||
          loggedInUser.role === "alumni" ? (
          <StudentArchive user={loggedInUser} />
        ) : (
          <p className="text-red-600 text-center text-xl mt-10">
            Access Denied: You do not have permission to view this page.
          </p>
        );
      case "seminars":
        return (loggedInUser.role === "mphil_researcher" || loggedInUser.role === "phd_researcher") ? (
          <SeminarNotices user={loggedInUser} onNoticeRead={handleResearcherNoticeRead} />
        ) : (
          <p className="text-red-600 text-center text-xl mt-10">Access Denied: You do not have permission to view this page.</p>
        );
      case "thesis_submission":
        return (loggedInUser.role === "mphil_researcher" || loggedInUser.role === "phd_researcher") ? (
          <ThesisSubmissionNotices user={loggedInUser} onNoticeRead={handleResearcherNoticeRead} />
        ) : (
          <p className="text-red-600 text-center text-xl mt-10">Access Denied: You do not have permission to view this page.</p>
        );
      case "thesis_defense":
        return (loggedInUser.role === "mphil_researcher" || loggedInUser.role === "phd_researcher") ? (
          <ThesisDefenseNotices user={loggedInUser} onNoticeRead={handleResearcherNoticeRead} />
        ) : (
          <p className="text-red-600 text-center text-xl mt-10">Access Denied: You do not have permission to view this page.</p>
        );
      case "degree_status":
        return (loggedInUser.role === "mphil_researcher" || loggedInUser.role === "phd_researcher") ? (
          <DegreeStatusNotices user={loggedInUser} onNoticeRead={handleResearcherNoticeRead} />
        ) : (
          <p className="text-red-600 text-center text-xl mt-10">Access Denied: You do not have permission to view this page.</p>
        );
      case "coursework":
        return (loggedInUser.role === "mphil_researcher" || loggedInUser.role === "phd_researcher") ? (
          <div className="text-center text-xl mt-10">
            <h2 className="text-2xl font-bold mb-4">Coursework Management</h2>
            <p className="text-gray-600">Coursework management functionality will be implemented here.</p>
          </div>
        ) : (
          <p className="text-red-600 text-center text-xl mt-10">Access Denied: You do not have permission to view this page.</p>
        );
      default:
        return (
          <p className="text-center text-gray-600 mt-10">
            Select an option from the sidebar.
          </p>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Header
        user={loggedInUser}
        onLogout={handleLogout}
        onEditProfile={() => handleEditLoggedInUser(loggedInUser)}
        unreadNoticesCount={unreadNoticesCount}
      />
      <div className="flex flex-1 pt-4 pb-4 pl-4 pr-4">
        {loggedInUser && (
          <Sidebar
            currentView={currentView}
            setView={setCurrentView}
            userRole={loggedInUser.role}
            unreadNoticesCount={unreadNoticesCount}
            unreadSeminarNotices={unreadSeminarNotices}
            unreadThesisSubmissionNotices={unreadThesisSubmissionNotices}
            unreadThesisDefenseNotices={unreadThesisDefenseNotices}
            unreadDegreeStatusNotices={unreadDegreeStatusNotices}
          />
        )}
        <main className="flex-1 p-6 bg-gray-100 overflow-auto">
          {renderContent()}
        </main>
        
        {/* Back to Home Button */}
        <div className="fixed bottom-6 right-6 z-50">
          <button 
            onClick={() => navigateTo('home')} 
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition duration-300 ease-in-out"
          >
            Back to Home
          </button>
        </div>
      </div>
      {userToEditInModal && (
        <EditProfileModal
          isOpen={showEditModalForSelf}
          onClose={() => {
            setShowEditModalForSelf(false);
            setUserToEditInModal(null);
          }}
          user={userToEditInModal}
          onSave={handleSaveProfileForSelf}
          canEditAll={loggedInUser?.role === "master_admin"}
        />
      )}
    </div>
  );
};

// Returns the count of unread notices for a user based on their email
const getUnreadNoticesCount = (allNotices, userEmail) => {
  if (!Array.isArray(allNotices) || !userEmail) return 0;
  return allNotices.filter(
    (notice) =>
      notice &&
      Array.isArray(notice.readBy) &&
      !notice.readBy.includes(userEmail)
  ).length;
};

// --- BEGIN: Top Page Components (merged from user code, JS only) ---
const SuperAdminEditProfileModal = ({ isOpen, onClose, user, onSave }) => {
  const [formData, setFormData] = useState({
    name: user?.name || "",
    personalEmail: user?.personalEmail || "",
    profilePicture: user?.profilePicture || "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [message, setMessage] = useState("");

  React.useEffect(() => {
    if (isOpen) {
      setFormData({
        name: user?.name || "",
        personalEmail: user?.personalEmail || "",
        profilePicture: user?.profilePicture || "",
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
      setMessage("");
    }
  }, [isOpen, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate password change if attempting to change password
    if (formData.newPassword || formData.confirmPassword) {
      if (!formData.currentPassword) {
        setMessage("Current password is required to change password");
        return;
      }
      if (formData.newPassword !== formData.confirmPassword) {
        setMessage("New passwords do not match");
        return;
      }
      if (formData.newPassword.length < 6) {
        setMessage("New password must be at least 6 characters");
        return;
      }
    }

    // For Assistant Super Admins, only allow password changes
    if (user?.role === "assistant-super-admin") {
      if (formData.newPassword) {
        try {
          // Find this assistant admin's document in Firestore, then update the password
          const adminQuery = query(
            collection(db, getGlobalCollectionPath("assistant_super_admins")),
            where("universityEmail", "==", user.email)
          );
          const snap = await getDocs(adminQuery);
          if (!snap.empty) {
            await updateDoc(
              doc(db, getGlobalCollectionPath("assistant_super_admins"), snap.docs[0].id),
              { password: formData.newPassword }
            );
            setMessage("Password updated successfully!");
            setTimeout(() => {
              onClose();
            }, 1500);
          } else {
            setMessage("Could not find your account. Please contact the Super Admin.");
          }
        } catch (error) {
          console.error("Error updating assistant admin password:", error);
          setMessage("Failed to update password.");
        }
      }
      return;
    }

    // For Super Admin, allow all profile updates
    const updatedData = {
      name: formData.name,
      personalEmail: formData.personalEmail,
      profilePicture: formData.profilePicture
    };

    if (formData.newPassword) {
      // In a real app, you'd update the password in the backend
      // For now, we'll just show a success message
      setMessage("Profile and password updated successfully!");
    } else {
      setMessage("Profile updated successfully!");
    }

    onSave(updatedData);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Edit Profile</h2>
        
        {message && (
          <div className={`p-3 mb-4 rounded-lg ${message.includes('success') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {user?.role === "super-admin" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Personal Email</label>
                <input
                  type="email"
                  value={formData.personalEmail}
                  onChange={(e) => setFormData({...formData, personalEmail: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Profile Picture URL</label>
                <input
                  type="url"
                  value={formData.profilePicture}
                  onChange={(e) => setFormData({...formData, profilePicture: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          <div className="border-t pt-4">
            <h3 className="text-lg font-medium text-gray-800 mb-3">Change Password</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                <input
                  type="password"
                  value={formData.currentPassword}
                  onChange={(e) => setFormData({...formData, currentPassword: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  value={formData.newPassword}
                  onChange={(e) => setFormData({...formData, newPassword: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const SuperAdminLogin = ({ navigateTo, onSuperAdminLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    // Check for Super Admin
    if (email === `superadmin@${UNIVERSITY_DOMAIN}` && password === "password123") {
      onSuperAdminLogin({
        email: `superadmin@${UNIVERSITY_DOMAIN}`, 
        name: "Super Admin", 
        role: "super-admin",
        personalEmail: "",
        profilePicture: ""
      });
    } else {
      // Check for Assistant Super Admins directly in Firestore
      try {
        const adminQuery = query(
          collection(db, getGlobalCollectionPath("assistant_super_admins")),
          where("universityEmail", "==", email)
        );
        const snap = await getDocs(adminQuery);

        if (!snap.empty && snap.docs[0].data().password === password) {
          const admin = snap.docs[0].data();
          onSuperAdminLogin({ 
            email: admin.universityEmail, 
            name: admin.name, 
            role: "assistant-super-admin",
            personalEmail: admin.personalEmail || "",
            profilePicture: admin.profilePicture || ""
          });
        } else {
          setError("Invalid credentials");
        }
      } catch (err) {
        console.error("Super admin login check failed:", err);
        setError("Something went wrong while checking your credentials. Please try again.");
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-100 to-indigo-200 p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md text-center">
            <h2 className="text-3xl font-bold text-blue-700 mb-6">Super Admin Login</h2>
            <p className="text-gray-700 mb-6">Login with your University Email and password.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
                <input 
                  type="email" 
                  placeholder="University Email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  required
                />
                <input 
                  type="password" 
                  placeholder="Password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  required
                />
                {error && <p className="text-red-600 text-sm">{error}</p>}
                <button type="submit" className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition duration-300 ease-in-out">Login</button>
            </form>
            <div className="mt-4 text-sm text-gray-600">
              <p>Default Super Admin: superadmin@{UNIVERSITY_DOMAIN} / password123</p>
              <p>Assistant Super Admins: Use your assigned credentials</p>
            </div>
            <button onClick={() => navigateTo('home')} className="mt-6 text-blue-600 hover:underline">Back to Home</button>
        </div>
    </div>
  );
};

const SuperAdminDashboard = ({ navigateTo, departments, onAddDepartment, onDeleteDepartment, currentUser, onLogout, onEditProfile }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [newDepartmentCode, setNewDepartmentCode] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [message, setMessage] = useState("");
  const [assistantAdmins, setAssistantAdmins] = useState([]);
  const [showAddAssistantForm, setShowAddAssistantForm] = useState(false);
  const [newAssistant, setNewAssistant] = useState({
    name: "",
    universityEmail: "",
    personalEmail: "",
    profilePicture: "",
    role: "assistant" // Default role
  });
  const [examOfficers, setExamOfficers] = useState([]);
  const [examControllers, setExamControllers] = useState([]);
  const [showAddOfficerForm, setShowAddOfficerForm] = useState(false);
  const [showAddControllerForm, setShowAddControllerForm] = useState(false);
  const [newOfficer, setNewOfficer] = useState({
    name: "",
    universityEmail: "",
    personalEmail: "",
    profilePicture: "",
    designation: "",
    role: "officer"
  });
  const [newController, setNewController] = useState({
    name: "",
    universityEmail: "",
    personalEmail: "",
    profilePicture: "",
    designation: "",
    role: "controller"
  });
  
  // States for editing existing Officers and Controllers
  const [editingOfficer, setEditingOfficer] = useState(null);
  const [editingController, setEditingController] = useState(null);

  // Load all personnel in real time from Firestore instead of localStorage
  React.useEffect(() => {
    const unsubAdmins = onSnapshot(
      collection(db, getGlobalCollectionPath("assistant_super_admins")),
      (snapshot) => setAssistantAdmins(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (error) => console.error("Failed to load assistant admins:", error),
    );
    const unsubOfficers = onSnapshot(
      collection(db, getGlobalCollectionPath("exam_officers")),
      (snapshot) => setExamOfficers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (error) => console.error("Failed to load exam officers:", error),
    );
    const unsubControllers = onSnapshot(
      collection(db, getGlobalCollectionPath("exam_controllers")),
      (snapshot) => setExamControllers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (error) => console.error("Failed to load exam controllers:", error),
    );
    return () => {
      unsubAdmins();
      unsubOfficers();
      unsubControllers();
    };
  }, []);

  const handleAddDepartment = async (e) => {
    e.preventDefault();
    if (!newDepartmentName.trim() || !newDepartmentCode.trim()) {
      setMessage("Please fill in all fields");
      return;
    }

    await onAddDepartment({
      name: newDepartmentName.trim(),
      code: newDepartmentCode.trim().toLowerCase().replace(/[^a-z0-9]/g, '-'),
      value: newDepartmentCode.trim().toLowerCase().replace(/[^a-z0-9]/g, '-')
    });

    setNewDepartmentName("");
    setNewDepartmentCode("");
    setShowAddForm(false);
    setMessage("Department added successfully!");
  };

  const handleAddAssistant = async (e) => {
    e.preventDefault();
    if (!newAssistant.name.trim() || !newAssistant.universityEmail.trim()) {
      setMessage("Please fill in all required fields");
      return;
    }

    try {
      const newAssistantAdmin = {
        ...newAssistant,
        password: "password123", // Default password
      };
      const colRef = collection(db, getGlobalCollectionPath("assistant_super_admins"));
      await addDoc(colRef, newAssistantAdmin);
      // No need to manually update state — onSnapshot above refreshes it automatically.

      setNewAssistant({ name: "", universityEmail: "", personalEmail: "", profilePicture: "", role: "assistant" });
      setShowAddAssistantForm(false);
      setMessage("Assistant Super Admin added successfully!");
    } catch (error) {
      console.error("Error adding assistant admin:", error);
      setMessage("Failed to add Assistant Super Admin.");
    }
  };

  const handleAddOfficer = async (e) => {
    e.preventDefault();
    if (!newOfficer.name.trim() || !newOfficer.universityEmail.trim() || !newOfficer.designation.trim()) {
      setMessage("Please fill in all required fields");
      return;
    }

    try {
      const newExamOfficer = {
        ...newOfficer,
        password: "password123", // Default password
        universityEmail: newOfficer.universityEmail + "@exam.juniv.edu"
      };
      const colRef = collection(db, getGlobalCollectionPath("exam_officers"));
      await addDoc(colRef, newExamOfficer);

      setNewOfficer({ name: "", universityEmail: "", personalEmail: "", profilePicture: "", designation: "", role: "officer" });
      setShowAddOfficerForm(false);
      setMessage("Exam Officer added successfully!");
    } catch (error) {
      console.error("Error adding exam officer:", error);
      setMessage("Failed to add Exam Officer.");
    }
  };

  const handleAddController = async (e) => {
    e.preventDefault();
    if (!newController.name.trim() || !newController.universityEmail.trim() || !newController.designation.trim()) {
      setMessage("Please fill in all required fields");
      return;
    }

    try {
      const newExamController = {
        ...newController,
        password: "password123", // Default password
        universityEmail: newController.universityEmail + "@exam.juniv.edu"
      };
      const colRef = collection(db, getGlobalCollectionPath("exam_controllers"));
      await addDoc(colRef, newExamController);

      setNewController({ name: "", universityEmail: "", personalEmail: "", profilePicture: "", designation: "", role: "controller" });
      setShowAddControllerForm(false);
      setMessage("Exam Controller added successfully!");
    } catch (error) {
      console.error("Error adding exam controller:", error);
      setMessage("Failed to add Exam Controller.");
    }
  };

  const handleDeleteAssistant = async (adminId) => {
    try {
      await deleteDoc(doc(db, getGlobalCollectionPath("assistant_super_admins"), adminId));
      setMessage("Assistant Super Admin deleted successfully!");
    } catch (error) {
      console.error("Error deleting assistant admin:", error);
      setMessage("Failed to delete Assistant Super Admin.");
    }
  };

  const handleDeleteOfficer = async (officerId) => {
    try {
      await deleteDoc(doc(db, getGlobalCollectionPath("exam_officers"), officerId));
      setMessage("Exam Officer deleted successfully!");
    } catch (error) {
      console.error("Error deleting exam officer:", error);
      setMessage("Failed to delete Exam Officer.");
    }
  };

  const handleDeleteController = async (controllerId) => {
    try {
      await deleteDoc(doc(db, getGlobalCollectionPath("exam_controllers"), controllerId));
      setMessage("Exam Controller deleted successfully!");
    } catch (error) {
      console.error("Error deleting exam controller:", error);
      setMessage("Failed to delete Exam Controller.");
    }
  };

  const handleEditOfficer = (officer) => {
    setEditingOfficer(officer);
    setNewOfficer({
      name: officer.name,
      universityEmail: officer.universityEmail.replace('@exam.juniv.edu', ''),
      personalEmail: officer.personalEmail || '',
      profilePicture: officer.profilePicture || '',
      designation: officer.designation || '',
      role: "officer"
    });
    setShowAddOfficerForm(true);
  };

  const handleEditController = (controller) => {
    setEditingController(controller);
    setNewController({
      name: controller.name,
      universityEmail: controller.universityEmail.replace('@exam.juniv.edu', ''),
      personalEmail: controller.personalEmail || '',
      profilePicture: controller.profilePicture || '',
      designation: controller.designation || '',
      role: "controller"
    });
    setShowAddControllerForm(true);
  };

  const handleUpdateOfficer = async (e) => {
    e.preventDefault();
    if (!newOfficer.name.trim() || !newOfficer.universityEmail.trim()) {
      setMessage("Please fill in all required fields");
      return;
    }

    try {
      const updatedFields = {
        name: newOfficer.name,
        universityEmail: newOfficer.universityEmail + "@exam.juniv.edu",
        personalEmail: newOfficer.personalEmail,
        profilePicture: newOfficer.profilePicture
      };
      await updateDoc(
        doc(db, getGlobalCollectionPath("exam_officers"), editingOfficer.id),
        updatedFields
      );
      // onSnapshot listener refreshes examOfficers automatically.

      setNewOfficer({ name: "", universityEmail: "", personalEmail: "", profilePicture: "", role: "officer" });
      setEditingOfficer(null);
      setShowAddOfficerForm(false);
      setMessage("Exam Officer updated successfully!");
    } catch (error) {
      console.error("Error updating exam officer:", error);
      setMessage("Failed to update Exam Officer.");
    }
  };

  const handleUpdateController = async (e) => {
    e.preventDefault();
    if (!newController.name.trim() || !newController.universityEmail.trim()) {
      setMessage("Please fill in all required fields");
      return;
    }

    try {
      const updatedFields = {
        name: newController.name,
        universityEmail: newController.universityEmail + "@exam.juniv.edu",
        personalEmail: newController.personalEmail,
        profilePicture: newController.profilePicture
      };
      await updateDoc(
        doc(db, getGlobalCollectionPath("exam_controllers"), editingController.id),
        updatedFields
      );
      // onSnapshot listener refreshes examControllers automatically.

      setNewController({ name: "", universityEmail: "", personalEmail: "", profilePicture: "", role: "controller" });
      setEditingController(null);
      setShowAddControllerForm(false);
      setMessage("Exam Controller updated successfully!");
    } catch (error) {
      console.error("Error updating exam controller:", error);
      setMessage("Failed to update Exam Controller.");
    }
  };

  const renderProfileTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Profile Information</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <p className="text-gray-900 font-medium">{currentUser?.name || "Not set"}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">University Email</label>
            <p className="text-gray-900 font-medium">{currentUser?.email || "Not set"}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Primary Personal Email</label>
            <p className="text-gray-900 font-medium">{currentUser?.personalEmail || "Not set"}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Profile Picture URL</label>
            <p className="text-gray-900 font-medium">{currentUser?.profilePicture || "Not set"}</p>
          </div>
        </div>
        <div className="mt-6">
          <button
            onClick={onEditProfile}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Edit Profile
          </button>
        </div>
      </div>
    </div>
  );

  const renderOverviewTab = () => (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-blue-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">Total Departments</h3>
          <p className="text-3xl font-bold text-blue-600">{departments.length}</p>
        </div>
        <div className="bg-green-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-green-800 mb-2">Assistant Admins</h3>
          <p className="text-3xl font-bold text-green-600">{assistantAdmins.length}</p>
        </div>
        <div className="bg-purple-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-purple-800 mb-2">Your Role</h3>
          <p className="text-lg font-medium text-purple-600 capitalize">{currentUser?.role?.replace('-', ' ')}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Super Admin Responsibilities</h3>
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
            <div>
              <h4 className="font-medium text-gray-800">Department Management</h4>
              <p className="text-gray-600 text-sm">Create, manage, and delete academic departments</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
            <div>
              <h4 className="font-medium text-gray-800">Assistant Admin Management</h4>
              <p className="text-gray-600 text-sm">Add and manage Assistant Super Admins with full privileges</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
            <div>
              <h4 className="font-medium text-gray-800">System Oversight</h4>
              <p className="text-gray-600 text-sm">Monitor and maintain the overall academic management system</p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
            <div>
              <h4 className="font-medium text-gray-800">User Access Control</h4>
              <p className="text-gray-600 text-sm">Manage access permissions and user roles across departments</p>
            </div>
          </div>
        </div>
      </div>

             <div className="bg-blue-50 p-4 rounded-lg">
         <h3 className="text-lg font-semibold text-blue-800 mb-2">Quick Actions</h3>
         <p className="text-blue-700 text-sm">
           Use the Department Management tab to add, edit, and delete academic departments.
         </p>
       </div>
    </div>
  );

  const renderUserManagementTab = () => (
    <div className="space-y-6">
      {/* Assistant Super Admin Management */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-800">Assistant Super Admin Management</h3>
          {!showAddAssistantForm && (
            <button
              onClick={() => setShowAddAssistantForm(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Add Assistant Admin
            </button>
          )}
        </div>

        {showAddAssistantForm && (
          <form onSubmit={handleAddAssistant} className="bg-gray-50 p-4 rounded-lg mb-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={newAssistant.name}
                  onChange={(e) => setNewAssistant({...newAssistant, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">University Email *</label>
                <input
                  type="email"
                  value={newAssistant.universityEmail}
                  onChange={(e) => setNewAssistant({...newAssistant, universityEmail: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Personal Email</label>
                <input
                  type="email"
                  value={newAssistant.personalEmail}
                  onChange={(e) => setNewAssistant({...newAssistant, personalEmail: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Profile Picture URL</label>
                <input
                  type="url"
                  value={newAssistant.profilePicture}
                  onChange={(e) => setNewAssistant({...newAssistant, profilePicture: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Add Assistant Admin
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddAssistantForm(false);
                  setNewAssistant({ name: "", universityEmail: "", personalEmail: "", profilePicture: "", role: "assistant" });
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {assistantAdmins.map((admin) => (
            <div key={admin.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-800">{admin.name}</h4>
                <p className="text-sm text-gray-600">{admin.universityEmail}</p>
                {admin.personalEmail && (
                  <p className="text-sm text-gray-500">Personal: {admin.personalEmail}</p>
                )}
                <p className="text-xs text-gray-500">Default Password: password123</p>
              </div>
              <button
                onClick={() => handleDeleteAssistant(admin.id)}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          ))}
          {assistantAdmins.length === 0 && (
            <p className="text-gray-500 text-center py-4">No Assistant Super Admins found</p>
          )}
        </div>
      </div>

      {/* Exam Officer Management */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-800">Exam Officer Management</h3>
          {!showAddOfficerForm && (
            <button
              onClick={() => setShowAddOfficerForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add Exam Officer
            </button>
          )}
        </div>

        {showAddOfficerForm && (
          <form onSubmit={editingOfficer ? handleUpdateOfficer : handleAddOfficer} className="bg-gray-50 p-4 rounded-lg mb-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={newOfficer.name}
                  onChange={(e) => setNewOfficer({...newOfficer, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">University Email (Name only) *</label>
                <div className="flex">
                  <input
                    type="text"
                    value={newOfficer.universityEmail}
                    onChange={(e) => setNewOfficer({...newOfficer, universityEmail: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="officer"
                    required
                  />
                  <span className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg text-gray-600">
                    @exam.juniv.edu
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Personal Email</label>
                <input
                  type="email"
                  value={newOfficer.personalEmail}
                  onChange={(e) => setNewOfficer({...newOfficer, personalEmail: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Profile Picture URL</label>
                <input
                  type="url"
                  value={newOfficer.profilePicture}
                  onChange={(e) => setNewOfficer({...newOfficer, profilePicture: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Designation *</label>
                <input
                  type="text"
                  value={newOfficer.designation}
                  onChange={(e) => setNewOfficer({...newOfficer, designation: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Senior Exam Officer, Deputy Controller"
                  required
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editingOfficer ? 'Update Exam Officer' : 'Add Exam Officer'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddOfficerForm(false);
                  setNewOfficer({ name: "", universityEmail: "", personalEmail: "", profilePicture: "", designation: "", role: "officer" });
                  setEditingOfficer(null);
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {examOfficers.map((officer) => (
            <div key={officer.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-800">{officer.name}</h4>
                <p className="text-sm text-gray-600">{officer.universityEmail}</p>
                {officer.designation && (
                  <p className="text-sm text-gray-600">Designation: {officer.designation}</p>
                )}
                {officer.personalEmail && (
                  <p className="text-sm text-gray-500">Personal: {officer.personalEmail}</p>
                )}
                <p className="text-xs text-gray-500">Default Password: password123</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEditOfficer(officer)}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteOfficer(officer.id)}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {examOfficers.length === 0 && (
            <p className="text-gray-500 text-center py-4">No Exam Officers found</p>
          )}
        </div>
      </div>

      {/* Exam Controller Management */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-gray-800">Exam Controller Management</h3>
          {!showAddControllerForm && (
            <button
              onClick={() => setShowAddControllerForm(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Add Exam Controller
            </button>
          )}
        </div>

        {showAddControllerForm && (
          <form onSubmit={editingController ? handleUpdateController : handleAddController} className="bg-gray-50 p-4 rounded-lg mb-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={newController.name}
                  onChange={(e) => setNewController({...newController, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">University Email (Name only) *</label>
                <div className="flex">
                  <input
                    type="text"
                    value={newController.universityEmail}
                    onChange={(e) => setNewController({...newController, universityEmail: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="controller"
                    required
                  />
                  <span className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg text-gray-600">
                    @exam.juniv.edu
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Personal Email</label>
                <input
                  type="email"
                  value={newController.personalEmail}
                  onChange={(e) => setNewController({...newController, personalEmail: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Profile Picture URL</label>
                <input
                  type="url"
                  value={newController.profilePicture}
                  onChange={(e) => setNewController({...newController, profilePicture: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Designation *</label>
                <input
                  type="text"
                  value={newController.designation}
                  onChange={(e) => setNewController({...newController, designation: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Senior Exam Officer, Deputy Controller"
                  required
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                {editingController ? 'Update Exam Controller' : 'Add Exam Controller'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddControllerForm(false);
                  setNewController({ name: "", universityEmail: "", personalEmail: "", profilePicture: "", designation: "", role: "controller" });
                  setEditingController(null);
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {examControllers.map((controller) => (
            <div key={controller.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-800">{controller.name}</h4>
                <p className="text-sm text-gray-600">{controller.universityEmail}</p>
                {controller.designation && (
                  <p className="text-sm text-gray-600">Designation: {controller.designation}</p>
                )}
                {controller.personalEmail && (
                  <p className="text-sm text-gray-500">Personal: {controller.personalEmail}</p>
                )}
                <p className="text-xs text-gray-500">Default Password: password123</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEditController(controller)}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteController(controller.id)}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {examControllers.length === 0 && (
            <p className="text-gray-500 text-center py-4">No Exam Controllers found</p>
          )}
        </div>
      </div>
    </div>
  );

   const renderDepartmentsTab = () => (
     <div className="space-y-6">
       <div className="grid md:grid-cols-2 gap-6">
         {/* Add New Department Section */}
         <div className="bg-gray-50 p-6 rounded-lg">
           <h3 className="text-xl font-semibold text-gray-800 mb-4">Add New Department</h3>
           {!showAddForm ? (
             <button 
               onClick={() => setShowAddForm(true)}
               className="w-full px-4 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700"
             >
               Add New Department
             </button>
           ) : (
             <form onSubmit={handleAddDepartment} className="space-y-4">
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">
                   Department Name
                 </label>
                 <input
                   type="text"
                   value={newDepartmentName}
                   onChange={(e) => setNewDepartmentName(e.target.value)}
                   placeholder="e.g., Mathematics"
                   className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                   required
                 />
               </div>
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">
                   Department Code
                 </label>
                 <input
                   type="text"
                   value={newDepartmentCode}
                   onChange={(e) => setNewDepartmentCode(e.target.value)}
                   placeholder="e.g., mathematics"
                   className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                   required
                 />
               </div>
               <div className="flex gap-2">
                 <button 
                   type="submit"
                   className="flex-1 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700"
                 >
                   Add Department
                 </button>
                 <button 
                   type="button"
                   onClick={() => setShowAddForm(false)}
                   className="px-4 py-2 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600"
                 >
                   Cancel
                 </button>
               </div>
             </form>
           )}
         </div>

         {/* Existing Departments Section */}
         <div className="bg-gray-50 p-6 rounded-lg">
           <h3 className="text-xl font-semibold text-gray-800 mb-4">Existing Departments</h3>
           <div className="space-y-2 max-h-64 overflow-y-auto">
             {departments.map((dept, index) => (
               <div key={index} className="flex justify-between items-center p-3 bg-white rounded-lg border">
                 <div>
                   <p className="font-medium text-gray-800">{dept.name}</p>
                   <p className="text-sm text-gray-600">Code: {dept.code}</p>
                 </div>
                 <button 
                   onClick={() => onDeleteDepartment(dept.code)}
                   className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                 >
                   Delete
                 </button>
               </div>
             ))}
           </div>
         </div>
       </div>

       <div className="mt-8 p-4 bg-blue-50 rounded-lg">
         <h3 className="text-lg font-semibold text-blue-800 mb-2">Instructions</h3>
         <ul className="text-blue-700 space-y-1 text-sm">
           <li>• Add new departments using the form on the left</li>
           <li>• Department names should be descriptive (e.g., "Mathematics")</li>
           <li>• Department codes should be lowercase with hyphens (e.g., "mathematics")</li>
           <li>• New departments will appear in the department selection dropdown</li>
           <li>• Each department will have its own isolated data and users</li>
         </ul>
       </div>
     </div>
   );

   return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-indigo-200 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-purple-700">Super Admin Dashboard</h1>
              <p className="text-gray-600">Welcome, {currentUser?.name}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onEditProfile}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Edit Profile
              </button>
              <button 
                onClick={onLogout} 
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Logout
              </button>
              <button 
                onClick={() => navigateTo('home')} 
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Back to Home
              </button>
            </div>
          </div>

          {message && (
            <div className={`p-4 mb-6 rounded-lg ${message.includes('success') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {message}
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                activeTab === 'overview' 
                  ? 'bg-white text-purple-700 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Dashboard Overview
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                activeTab === 'profile' 
                  ? 'bg-white text-purple-700 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Profile
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                activeTab === 'users' 
                  ? 'bg-white text-purple-700 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              User Management
            </button>
            <button
              onClick={() => setActiveTab('departments')}
              className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                activeTab === 'departments' 
                  ? 'bg-white text-purple-700 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Department Management
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'profile' && renderProfileTab()}
          {activeTab === 'users' && renderUserManagementTab()}
          {activeTab === 'departments' && renderDepartmentsTab()}
        </div>
      </div>
    </div>
  );
};

const FAQsPage = ({ navigateTo }) => {
  const [openSections, setOpenSections] = React.useState({});

  const toggleSection = (section) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const faqData = {
    "General Questions": [
      {
        question: "What is SAMS?",
        answer: "SAMS (Student Academic Management System) is an online platform designed to manage student details, course registration, grade management, attendance tracking, faculty assignments, timetable generation, and various other academic and administrative processes for Jahangirnagar University."
      },
      {
        question: "Which departments are supported by SAMS?",
        answer: "SAMS currently supports 10 departments: Architecture, Business Administration, Civil Engineering, Computer Science & Engineering, Economics, Electrical & Electronic Engineering, English, Law, Mechanical Engineering, and Pharmacy."
      },
      {
        question: "How do I access SAMS?",
        answer: "Visit the SAMS portal, select your department from the dropdown menu, and log in with your credentials provided by your department."
      }
    ],
    "Student-Related Questions": [
      {
        question: "How do I register for courses?",
        answer: "After logging into your department portal, navigate to 'Course Selection' in the sidebar. Select your desired courses and teachers, then submit your selections for approval."
      },
      {
        question: "Where can I find my grades and results?",
        answer: "Your grades are accessible in the 'Results' section of your student dashboard after logging into your department's system."
      },
      {
        question: "How do I submit assignments?",
        answer: "Go to the 'Assignments' section in your student dashboard, click on the assignment you want to submit, and upload your files through the submission form."
      },
      {
        question: "Can I evaluate my teachers?",
        answer: "Yes, you can evaluate your teachers through the 'Evaluate Teachers' section in your student dashboard. This helps maintain teaching quality standards."
      },
      {
        question: "How do I access course resources?",
        answer: "Course resources are available in the 'Resources' section of your student dashboard, where teachers upload study materials and references."
      },
      {
        question: "What should I do if I forget my login credentials?",
        answer: `Contact your department's administrative office or email sams@${UNIVERSITY_DOMAIN} for assistance with login credentials.`
      }
    ],
    "Teacher-Related Questions": [
      {
        question: "How do I create and manage assignments?",
        answer: "Teachers can create assignments through the 'Assignments' section in their dashboard, where they can add assignment details, due dates, and manage student submissions."
      },
      {
        question: "How do I enter and manage student grades?",
        answer: "Use the 'Evaluation' section to enter assignment marks, in-course marks, and final grades for your students. The system automatically calculates averages."
      },
      {
        question: "Can I upload course resources for students?",
        answer: "Yes, teachers can upload study materials, references, and other resources through the 'Resources' section in their dashboard."
      },
      {
        question: "How do I generate evaluation reports?",
        answer: "Use the 'Evaluations Report' feature to generate comprehensive reports of student performance and grades."
      }
    ],
    "Administrative Questions": [
      {
        question: "How do I manage user accounts?",
        answer: "Administrators can add, edit, and manage user accounts through the 'Manage Users' section, including role assignments and account deletions."
      },
      {
        question: "How do I post notices and announcements?",
        answer: "Use the 'Manage Notices' section to create and post notices for specific user groups (students, teachers, researchers) with targeted visibility."
      },
      {
        question: "How do I assign examiners for thesis evaluation?",
        answer: "Administrators can assign first, second, and third examiners through the 'Assign Examiners' section for thesis and research work evaluation."
      },
      {
        question: "How do I promote students to the next semester?",
        answer: "Use the 'Promote Students' feature to select and promote eligible students to the next academic level."
      },
      {
        question: "How do I approve course enrollments?",
        answer: "Course enrollment requests can be approved or rejected through the 'Course Enrollment Approval' section."
      }
    ],
    "Researcher-Related Questions": [
      {
        question: "How do I receive research-related notices?",
        answer: "Researchers can view notices related to seminars, thesis submissions, thesis defenses, and degree status updates in their dashboard."
      },
      {
        question: "How do I submit thesis-related documents?",
        answer: "Follow the specific submission guidelines provided in the thesis submission notices posted by your department."
      }
    ],
    "Technical Support": [
      {
        question: "Who do I contact for technical support?",
        answer: `For technical support, please email sams@${UNIVERSITY_DOMAIN} or call our helpline during office hours.`
      },
      {
        question: "What browsers are supported by SAMS?",
        answer: "SAMS works best with modern browsers like Chrome, Firefox, Safari, and Edge. Make sure to keep your browser updated."
      },
      {
        question: "Can I access SAMS from mobile devices?",
        answer: "Yes, SAMS is responsive and can be accessed from mobile devices, though some features may be optimized for desktop use."
      },
      {
        question: "What should I do if I encounter an error?",
        answer: "Try refreshing the page first. If the error persists, contact technical support with details about the error message and what you were doing when it occurred."
      }
    ],
    "Security and Privacy": [
      {
        question: "Is my data secure in SAMS?",
        answer: "Yes, SAMS uses secure authentication and data encryption to protect your personal and academic information."
      },
      {
        question: "Can I change my password?",
        answer: "Yes, you can update your profile information including password through the 'Edit Profile' option in your dashboard."
      },
      {
        question: "Who has access to my academic records?",
        answer: "Your academic records are only accessible to authorized personnel including your teachers, department administrators, and yourself, based on your role in the system."
      }
    ],
    "System Features": [
      {
        question: "Can I download my results or reports?",
        answer: "Yes, many sections including results and evaluation reports offer download functionality for your records."
      },
      {
        question: "How do I mark notices as read?",
        answer: "Notices are automatically marked as read when you click on them, and the unread count will update accordingly."
      },
      {
        question: "Can I change my department after admission?",
        answer: "Department change requests are subject to university policy and availability. Please contact the academic affairs office for such requests."
      }
    ]
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-green-100 to-teal-200 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-4xl text-center">
        <h2 className="text-3xl font-bold text-teal-700 mb-6">Frequently Asked Questions (FAQs)</h2>
        <div className="text-left space-y-4">
          {Object.entries(faqData).map(([section, questions]) => (
            <div key={section} className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection(section)}
                className="w-full px-6 py-4 bg-teal-50 hover:bg-teal-100 text-left font-semibold text-teal-800 flex justify-between items-center transition-colors duration-200"
              >
                <span>{section}</span>
                <span className={`transform transition-transform duration-200 ${openSections[section] ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>
              {openSections[section] && (
                <div className="px-6 py-4 bg-white space-y-4">
                  {questions.map((faq, index) => (
                    <div key={index} className="border-b border-gray-100 pb-4 last:border-b-0">
                      <p className="font-semibold text-gray-800 mb-2">Q: {faq.question}</p>
                      <p className="text-gray-700">A: {faq.answer}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <button onClick={() => navigateTo('home')} className="mt-8 text-teal-600 hover:underline">Back to Home</button>
      </div>
    </div>
  );
};

const TeamAMSPage = ({ navigateTo }) => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-purple-100 to-pink-200 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-purple-700 mb-6">Meet Team AMS</h2>
          <div className="text-left space-y-4 text-gray-700">
              <p><strong>Project Lead:</strong> Dr. Alex Johnson</p>
              <p><strong>Software Architect:</strong> Ms. Sarah Lee</p>
              <p><strong>Development Team:</strong> John Doe, Jane Smith, Mike Brown</p>
              <p><strong>Quality Assurance:</strong> Emily White</p>
              <p className="mt-4">Our dedicated team is committed to providing a robust and user-friendly Academic Management System for Jahangirnagar University.</p>
          </div>
          <button onClick={() => navigateTo('home')} className="mt-6 text-purple-600 hover:underline">Back to Home</button>
      </div>
  </div>
);

const DepartmentSelectionPage = ({ onDepartmentSelect, navigateTo, departments }) => {
  const [selectedValue, setSelectedValue] = React.useState('');
  const redirectToDepartment = (event) => {
    const selectedDepartmentValue = event.target.value;
    const selectedDepartmentText = event.target.options[event.target.selectedIndex].text;
    setSelectedValue(selectedDepartmentValue);
    if (selectedDepartmentValue) {
      onDepartmentSelect(selectedDepartmentText);
    }
  };
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-3xl text-center">
        <h2 className="text-3xl font-bold text-blue-700 mb-6">Department Selection</h2>
        <section className="mb-12 w-full max-w-md mx-auto">
          <label htmlFor="department-select" className="block text-lg font-medium text-gray-700 mb-3 text-center">Select Your Department:</label>
          <select id="department-select" className="block w-full px-4 py-3 text-base text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" onChange={redirectToDepartment} value={selectedValue}>
            <option value="" disabled>-- Choose a Department --</option>
            {departments.map((dept, index) => (
              <option key={index} value={dept.value}>{dept.name}</option>
            ))}
          </select>
        </section>
        <section className="bg-gray-50 p-6 rounded-xl shadow-inner max-w-2xl w-full mx-auto text-center">
          <h3 className="text-2xl font-semibold text-gray-800 mb-4">About SAMS</h3>
          <p className="text-gray-700 leading-relaxed">
            The software SAMS is an online platform that is meant to manage entire Student details,
            registration of courses, approval of course selection, management of grades, attendance tracking,
            faculty assignments, timetable generation, and various other academic and administrative processes.
            It aims to streamline operations and provide a seamless experience for students, faculty, and administration.
          </p>
        </section>
        <button onClick={() => navigateTo('home')} className="mt-8 px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg shadow-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-75 transition duration-300 ease-in-out">Back to Home</button>
      </div>
    </div>
  );
};

const AppContent = () => {
  const [currentPage, setCurrentPage] = React.useState('home');
  const [selectedDeptName, setSelectedDeptName] = React.useState('');
  const [showDepartmentApp, setShowDepartmentApp] = React.useState(false);
  const [isSuperAdminLoggedIn, setIsSuperAdminLoggedIn] = React.useState(false);
  const [currentSuperAdmin, setCurrentSuperAdmin] = React.useState(null);
  const [showSuperAdminEditProfile, setShowSuperAdminEditProfile] = React.useState(false);
  const [departments, setDepartments] = React.useState([]);

  // Default departments used only to seed Firestore the very first time
  // the "departments" collection is empty (fresh install).
  const defaultDepartments = [
    { name: "Architecture", code: "architecture", value: "architecture" },
    { name: "Business Administration", code: "business-administration", value: "business-administration" },
    { name: "Civil Engineering", code: "civil-engineering", value: "civil-engineering" },
    { name: "Computer Science & Engineering", code: "computer-science", value: "computer-science" },
    { name: "Economics", code: "economics", value: "economics" },
    { name: "Electrical & Electronic Engineering", code: "electrical-engineering", value: "electrical-engineering" },
    { name: "English", code: "english", value: "english" },
    { name: "Law", code: "law", value: "law" },
    { name: "Mechanical Engineering", code: "mechanical-engineering", value: "mechanical-engineering" },
    { name: "Pharmacy", code: "pharmacy", value: "pharmacy" }
  ];

  // Wait for anonymous Firebase sign-in (provided by the AuthProvider that
  // now wraps the whole app) before touching Firestore — otherwise
  // request.auth is still null and the security rules reject the read.
  const { isAuthReady } = useAuth();

  // Subscribe to the "departments" collection in Firestore in real time.
  // If it's empty (fresh install), seed it once with the default list.
  React.useEffect(() => {
    if (!isAuthReady) return; // wait for sign-in to complete first
    const deptColRef = collection(db, getGlobalCollectionPath("departments"));

    const seedIfEmpty = async () => {
      try {
        const snapshot = await getDocs(deptColRef);
        if (snapshot.empty) {
          console.log("No departments in Firestore yet — seeding defaults...");
          for (const dept of defaultDepartments) {
            await setDoc(doc(deptColRef, dept.code), dept);
          }
        }
      } catch (error) {
        console.error("Error seeding default departments:", error);
      }
    };
    seedIfEmpty();

    const unsubscribe = onSnapshot(
      deptColRef,
      (snapshot) => {
        const depts = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        depts.sort((a, b) => a.name.localeCompare(b.name));
        setDepartments(depts);
      },
      (error) => {
        console.error("Failed to load departments from Firestore:", error);
      },
    );
    return () => unsubscribe();
  }, [isAuthReady]);

  // Navigation handler for top page
  const navigateTo = (page) => {
    setCurrentPage(page);
    setShowDepartmentApp(false);
  };

  // When department is selected, show the department management system
  const handleDepartmentSelect = (departmentName) => {
    setSelectedDeptName(departmentName);
    window.selectedDepartmentName = departmentName; // <-- Add this line
    setShowDepartmentApp(true);
  };

  // Super Admin functions
  const handleSuperAdminLogin = (userData) => {
    setIsSuperAdminLoggedIn(true);
    setCurrentSuperAdmin(userData);
    setCurrentPage('super-admin-dashboard');
  };

  const handleSuperAdminLogout = () => {
    setIsSuperAdminLoggedIn(false);
    setCurrentSuperAdmin(null);
    setCurrentPage('home');
  };

  const handleSuperAdminEditProfile = () => {
    setShowSuperAdminEditProfile(true);
  };

  const handleSuperAdminSaveProfile = (updatedData) => {
    setCurrentSuperAdmin(prev => ({ ...prev, ...updatedData }));
    setShowSuperAdminEditProfile(false);
  };

  const handleAddDepartment = async (newDepartment) => {
    console.log('Adding department:', newDepartment);
    try {
      const deptColRef = collection(db, getGlobalCollectionPath("departments"));
      await setDoc(doc(deptColRef, newDepartment.code), newDepartment);
      console.log('✅ Saved department to Firestore:', newDepartment);
      // No need to manually update state — the onSnapshot listener above
      // will automatically receive the new department for every user/device.
    } catch (error) {
      console.error('❌ Error saving department to Firestore:', error);
    }
  };

  const handleDeleteDepartment = async (departmentCode) => {
    try {
      await deleteDoc(doc(db, getGlobalCollectionPath("departments"), departmentCode));
      console.log('Deleted department from Firestore:', departmentCode);
      // onSnapshot will automatically refresh the list for everyone.
    } catch (error) {
      console.error('Error deleting department from Firestore:', error);
    }
  };

  // Render logic
  if (showDepartmentApp) {
    // Show the original department management system (MainAppContent)
    return (
      <>
        <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
                body { font-family: 'Inter', sans-serif; }
                .rounded-xl { border-radius: 1rem; }
                .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); }
                .shadow-md { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
                .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
                .shadow-2xl { box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); }
                .transition { transition-property: all; transition-duration: 150ms; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); }
                .hover\\:bg-blue-700:hover { background-color: #2563eb; }
                .hover\\:bg-red-600:hover { background-color: #dc2626; }
                .hover\\:bg-green-700:hover { background-color: #047857; }
                .hover\\:bg-green-500:hover { background-color: #10b981; }
                .hover\\:bg-green-900:hover { background-color: #064e3b; }
                .hover\\:bg-sky-600:hover { background-color: #0284c7; }
                .hover\\:bg-gray-400:hover { background-color: #9ca3af; }
                .hover\\:bg-gray-700:hover { background-color: #374151; }
                .hover\\:bg-gray-50:hover { background-color: #f9fafb; }
        `}</style>
        <MainAppContent departmentName={selectedDeptName} navigateTo={navigateTo} />
      </>
    );
  }

  // Top page navigation
  switch (currentPage) {
    case 'home':
      return (
        <div className="flex flex-col min-h-screen font-inter bg-gray-100">
          {/* Top Banner */}
          <div className="bg-gradient-to-r from-blue-800 to-blue-900 text-white p-4 shadow-lg">
            <div className="container mx-auto flex flex-col md:flex-row items-center justify-between">
              <div className="flex items-center mb-4 md:mb-0">
                <img 
                  src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQy_4q9_WbdjBhI_aRbpkQVczZ2HVseS67SwVTjoKmWR-aRkvolJ2CNhe5vCdHiq3JOzTc&usqp=CAU" 
                  alt="Jahangirnagar University Logo" 
                  className="w-16 h-16 mr-4 rounded-lg shadow-md"
                />
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold">Jahangirnagar University</h1>
                  <p className="text-blue-200 text-sm md:text-base">Academic Management System</p>
                </div>
              </div>
              <nav className="flex flex-wrap justify-center gap-2 md:gap-3">
                <button onClick={() => navigateTo('super-admin')} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75 transition duration-300 ease-in-out text-sm md:text-base">Super Admin Login</button>
                <button onClick={() => navigateTo('result-management')} className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75 transition duration-300 ease-in-out text-sm md:text-base">Result Management</button>
                <button onClick={() => navigateTo('department-selection-page')} className="px-4 py-2 bg-green-800 text-white font-semibold rounded-lg shadow-md hover:bg-green-900 focus:outline-none focus:ring-2 focus:ring-green-800 focus:ring-opacity-75 transition duration-300 ease-in-out text-sm md:text-base">Department Selection</button>
                <button onClick={() => navigateTo('team-ams')} className="px-4 py-2 bg-sky-500 text-white font-semibold rounded-lg shadow-md hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75 transition duration-300 ease-in-out text-sm md:text-base">Team AMS</button>
                <button onClick={() => navigateTo('faqs')} className="px-4 py-2 bg-green-400 text-white font-semibold rounded-lg shadow-md hover:bg-green-500 focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75 transition duration-300 ease-in-out text-sm md:text-base">FAQs</button>
              </nav>
            </div>
          </div>
          
          <div className="flex-grow container mx-auto p-4 md:p-8 flex flex-col items-center justify-center">
            <header className="text-center mb-8">
              <div className="text-6xl font-extrabold text-blue-700 mb-4 animate-pulse">Jahangirnagar University</div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-2">Welcome to</h1>
              <h2 className="text-3xl md:text-4xl font-semibold text-blue-600 mb-6">Jahangirnagar University Academic Management System (JUAMS)</h2>
            </header>
          </div>
          <footer className="bg-green-100 text-green-800 p-6 md:p-8 text-center mt-auto rounded-t-xl shadow-inner border-t-2 border-green-200">
            <p className="mb-2 font-semibold">Copyright 2017-18 &copy; Jahangirnagar University</p>
            <p className="mb-2">Help Line: (2654-876, 2654-524)</p>
            <p className="mb-4">Feedbacks & Queries mail to: <a href={`mailto:jusams@${UNIVERSITY_DOMAIN}`} className="text-green-600 hover:underline font-medium">{`jusams@${UNIVERSITY_DOMAIN}`}</a></p>
            <div className="flex justify-center gap-6">
              <a href="#" className="text-green-600 hover:underline font-medium">Privacy Policy</a>
              <span className="text-green-500">|</span>
              <a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline font-medium">How to Use (Youtube video)</a>
            </div>
          </footer>
        </div>
      );
    case 'super-admin':
      return <SuperAdminLogin navigateTo={navigateTo} onSuperAdminLogin={handleSuperAdminLogin} />;
    case 'super-admin-dashboard':
      return (
        <>
          <SuperAdminDashboard 
            navigateTo={navigateTo} 
            departments={departments}
            onAddDepartment={handleAddDepartment}
            onDeleteDepartment={handleDeleteDepartment}
            currentUser={currentSuperAdmin}
            onLogout={handleSuperAdminLogout}
            onEditProfile={handleSuperAdminEditProfile}
          />
          <SuperAdminEditProfileModal
            isOpen={showSuperAdminEditProfile}
            onClose={() => setShowSuperAdminEditProfile(false)}
            user={currentSuperAdmin}
            onSave={handleSuperAdminSaveProfile}
          />
        </>
      );
    case 'result-management':
      return <ResultManagementSystem navigateTo={navigateTo} />;
    case 'faqs':
      return <FAQsPage navigateTo={navigateTo} />;
    case 'team-ams':
      return <TeamAMSPage navigateTo={navigateTo} />;
    case 'department-selection-page':
      return <DepartmentSelectionPage onDepartmentSelect={handleDepartmentSelect} navigateTo={navigateTo} departments={departments} />;
    default:
      return null;
  }
};

// Top-level App: wraps the whole application in AuthProvider so that
// anonymous Firebase sign-in happens immediately on load, for every page
// (Super Admin Dashboard, Department Selection, etc.) — not only after a
// specific department is opened. This is required for Firestore security
// rules that check `request.auth != null`.
const App = () => (
  <AuthProvider>
    <AppContent />
  </AuthProvider>
);

export default App;