<div align="center">

# 📚 لایتنر پرو

### یادگیری هوشمند لغات انگلیسی با الگوریتم FSRS

![Version](https://img.shields.io/badge/version-3.8.3-7c5cfc?style=flat-square)
![License](https://img.shields.io/badge/license-free-34d399?style=flat-square)
![PWA](https://img.shields.io/badge/PWA-ready-34d399?style=flat-square)

[**🚀 [نسخه دمو (وب)](https://mohsen-niksirat.github.io/Leitner_Mobile)**
</div>

---

## ✨ ویژگی‌ها

### 🧠 الگوریتم یادگیری هوشمند
- **FSRS (Free Spaced Repetition Scheduler)** — پیشرفته‌ترین الگوریتم تکرار فاصله‌دار
- محاسبه خودکار زمان مرور هر لغت بر اساس عملکرد شما
- ۱۰ باکس یادگیری با انتقال هوشمند بین سطوح

### 📝 ۹ نوع آزمون متنوع
- 🔤 چهارگزینه‌ای
- ⌨️ تایپی
- 🇬🇧 انگلیسی به انگلیسی
- 📝 جای خالی
- ⚡ سرعتی
- 🎧 شنیداری
- 🔄 مترادف
- ↔️ متضاد
- 📖 جمله‌سازی

### 📚 پک‌های لغت آماده
- 📗 504 کلمه
- 📕 1100 کلمه
- 🎓 آیلتس / تافل / GRE
- 💻 کامپیوتر و IT
- 💼 بیزنس / پزشکی / آکادمیک
- 💬 مکالمه روزمره

### ☁️ ذخیره‌سازی ابری
- **Google Drive Sync** — ذخیره خودکار در Drive شخصی
- ورود با اکانت گوگل (OAuth2)
- همگام‌سازی بین چند دستگاه
- بدون نیاز به سرور

### 🎨 رابط کاربری مدرن
- طراحی Glassmorphism
- حالت تاریک و روشن
- فونت وزیرمتن
- کاملاً ریسپانسیو

---

## ✅ کاملاً رایگان

- **بدون محدودیت** در تعداد لغات
- **بدون تبلیغات**
- **همه امکانات** از ابتدا آزاد
- فقط با حمایت مالی (دونیت) توسعه داده می‌شود

---

## 🚀 نصب و اجرا

### نسخه وب (PWA)

```bash
git clone https://github.com/mohsen-niksirat/Leitner_Mobile.git
cd leitner-mobile

# مستقیم با مرورگر باز کنید
# یا با سرور ساده:
npx serve .
```

### نسخه Android (Capacitor)

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "لایتنر پرو" "ir.leitnerpro.mobile" --web-dir .
npx cap add android
npx cap sync android
npx cap run android
```

---

## 🏗️ ساختار پروژه

```
leitner-mobile/
├── index.html              # اپلیکیشن اصلی
├── gdrive-sync.js          # ماژول Google Drive
├── manifest.json           # PWA Manifest
├── service-worker.js       # Service Worker
├── icons/                  # آیکون‌های اپ
└── packs/                  # پک‌های لغت
    ├── 504words.json
    ├── 1100words.json
    ├── ielts.json
    ├── toefl.json
    ├── gre.json
    ├── computer.json
    ├── daily.json
    ├── academic.json
    ├── medical.json
    └── business.json
```

---

## ☁️ تنظیم Google Drive

برای استفاده از قابلیت ذخیره‌سازی ابری:

1. به [console.cloud.google.com](https://console.cloud.google.com) بروید
2. پروژه جدید بسازید
3. Google Drive API را فعال کنید
4. OAuth consent screen تنظیم کنید
5. OAuth Client ID بسازید (Web application)
6. در اپ: ابزارها → Google Drive → تنظیم Client ID

---

## 💰 حمایت مالی

این اپلیکیشن کاملاً رایگان است. اگر برایتان مفید بوده:

💳 **بانک ملی:** `6037-9972-5364-7409` — محسن نیک‌سیرت
💳 **بانک ملت:** `6104-3311-4532-7673` — محسن نیک‌سیرت

---

## 🔧 تکنولوژی‌ها

| بخش | تکنولوژی |
|-----|----------|
| فرانت‌اند | Vanilla JS + CSS3 |
| پایگاه داده | IndexedDB |
| الگوریتم | FSRS v4 |
| ذخیره ابری | Google Drive API |
| PWA | Service Worker |
| فونت | Vazirmatn |

---

## 📄 مجوز

این پروژه رایگان و متن‌باز است.

---

<div align="center">

**ساخته شده با ❤️ برای یادگیری بهتر زبان انگلیسی**

[⭐ Star](https://github.com/mohsen-niksirat/Leitner_Mobile/stargazers) ·
[🐛 Issues](https://github.com/mohsen-niksirat/Leitner_Mobile/issues) ·
[🚀 دمو](https://mohsen-niksirat.github.io/Leitner_Mobile)

</div>
