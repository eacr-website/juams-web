# JUAMS Web — চালানোর নির্দেশনা

এই প্রজেক্টটা আপনার `University_Page.js` কোডকে ঘিরে তৈরি একটা রান-করা-যায় এমন React (Vite) প্রজেক্ট।
Firebase কনফিগ ইতিমধ্যে `src/App.jsx` ফাইলে বসানো আছে (আপনার juams-prod প্রজেক্ট)।

## নিজের কম্পিউটারে টেস্ট করতে (ঐচ্ছিক)

```
npm install
npm run dev
```

তারপর ব্রাউজারে http://localhost:5173 খুললে অ্যাপ চলবে।

## Netlify-তে ডিপ্লয় করতে

সবচেয়ে সহজ পথ: এই পুরো ফোল্ডারটা একটা GitHub রিপোজিটরিতে পুশ করে, তারপর Netlify-তে
"Add new site" > "Import an existing project" > GitHub রিপো বেছে নিন।
Netlify নিজে থেকেই `netlify.toml` ফাইল দেখে বিল্ড কমান্ড (`npm run build`) ও
পাবলিশ ফোল্ডার (`dist`) বুঝে নেবে — কিছু বদলানোর দরকার নেই।

## ফাইল স্ট্রাকচার

- `src/App.jsx` — আপনার আসল অ্যাপের সম্পূর্ণ কোড (অপরিবর্তিত, শুধু Firebase config বসানো)
- `src/main.jsx` — অ্যাপটাকে ব্রাউজারে মাউন্ট করে
- `src/index.css` — Tailwind CSS চালু করে
- `index.html` — এন্ট্রি HTML ফাইল
- `vite.config.js`, `tailwind.config.js`, `postcss.config.js` — বিল্ড/স্টাইল কনফিগ
- `netlify.toml` — Netlify কে বলে দেয় কীভাবে বিল্ড ও ডিপ্লয় করতে হবে
- `package.json` — প্রয়োজনীয় সব লাইব্রেরির তালিকা
