# 🚀 JanSetu — Civic Issues. Resolved. Faster.

A graph-powered bilingual civic tech mobile platform that connects citizens, complaints, locations, and government departments to streamline infrastructure resolution.

---

## About

JanSetu Multiverse is a platform that simplifies civic issue reporting and tracking. It resolves routing inefficiency, lack of public accountability, and duplicate reports. The mobile app serves citizens who want to report issues via voice or text in Hindi or English, and administrators who monitor and assign complaints.

---

## ✨ Features

* 🌐 **Bilingual Interface**: Seamless Hindi and English interface toggles across the entire mobile application.
* 🎙️ **Voice-to-Text Complaint Submission**: Integrated voice recording and speech recognition for natural, hands-free reporting in both English and Hindi.
* 📍 **GPS Auto-Location Detection**: Automatically retrieves the user's current coordinates (latitude/longitude) and reverse-geocodes it to auto-populate the City, Area (including all Noida sectors 1-137), and Ward.
* 🗺️ **Live Interactive Leaflet Map**: Powered by WebView and Leaflet with CartoDB Dark Matter tiles, displaying real geographical hazard clusters across India with glowing visual halos and detailed hotspot inspection.
* 📜 **Automated RTI Drafter**: A step-by-step wizard (Applicant, Public, Information, Review) that generates legally formatted Right to Information applications ready for copy-pasting.
* 🔄 **Direct Database Sync**: Bypasses edge proxies by connecting directly to the Neo4j Aura Graph database client-side to calculate counts (Total, Resolved, Pending, Escalated) dynamically for the home page.
* 📬 **External Server Integration**: Outgoing complaint POST pipeline connects directly to the Node.js Express server hosted on Render (`https://jansetu-multiverse.onrender.com/api/complaint`).

---

## 🛠️ Tech Stack

### Mobile Client
* **Core**: Expo (React Native), TypeScript, Expo Router
* **Interactive Maps**: HTML5 Leaflet, CartoDB Dark Matter tiles embedded in React Native Webview
* **Styling**: React Native StyleSheet (for perfect native UI compatibility)

### Backend & AI
* **APIs**: expo-speech, expo-location (for GPS tracking), and expo-image-picker
* **Database**: Neo4j AuraDB (Direct HTTP basic authentication query/v2 execution)
* **External Complaint Server**: Node.js Express server hosted on Render (`https://jansetu-multiverse.onrender.com/api/complaint`)

---

## 🚀 How to Run the Project

### Prerequisites

* Node.js (version 18 or higher)
* A Neo4j AuraDB instance (or local Neo4j)
* USB Debugging enabled on your Android device (connected via USB)

### 1. Clone the repository

```bash
git clone https://github.com/PRIYANKA-NEGI-28/JANSETU-MULTIVERSE.git
cd JANSETU-MULTIVERSE
```

### 2. Set up the Environment Variables

Create a `.env` file in the root directory:

```env
EXPO_PUBLIC_NEO4J_PROXY_URL= YOUR_NEO4J_PROXY_URL
EXPO_PUBLIC_SARVAM_API_KEY= YOUR_SARVAM_API_KEY
EXPO_PUBLIC_GEMINI_API_KEY= YOUR_GEMINI_API_KEY
EXPO_PUBLIC_COMPLAINT_SERVER_URL= YOUR_COMPLAINT_SERVER_URL
```

### 3. Install Dependencies and Run

```bash
npm install
npm run dev
```

### 4. Build and Install Android App via USB

After connecting the via USB remember to enable developer option on your Phone by clicking build number 7 times in about phone section in settings. And also enable USB debugging.

```bash
# Build the Release APK
./android/gradlew -p android assembleRelease --no-daemon

# Install and Launch on Connected USB Device
adb install -r jansetu-app.apk
adb shell am start -n com.jansetu.app/.MainActivity

```

---

## 🧬 Future Scope

* 📈 **Municipal Integrations** — Direct integration with municipal complaint-management systems and government APIs.
* 🛡️ **Security Enhancements** — Stronger verification for citizen and officer accounts, audit trails on escalations.
* 🌐 **Localization / Broader Accessibility** — Support for more regional Indian languages beyond Hindi/English, offline-first mobile support for low-connectivity areas.

---
