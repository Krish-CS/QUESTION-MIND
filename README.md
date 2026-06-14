# Question Mind 🧠

Question Mind is an AI-powered Question Bank generation system. It automatically parses Syllabus and CDAP documents (PDF, Excel, Docx) and generates categorized question banks using advanced LLMs (Groq, Cerebras, NVIDIA NIM, OpenRouter). 

The platform supports **two** distinct deployment environments with a shared unified database and Google Drive storage mechanism.

---

## 🏗️ Architecture

### 1. Website Version (`/frontend`)
- **Frontend**: Built with React, Vite, TailwindCSS, and Zustand.
- **Backend (`/backend-python`)**: FastAPI server designed to be deployed to Render or Railway.
- **Connection**: The web frontend communicates with the remote FastAPI server via standard HTTP requests (Axios).

### 2. Mobile App Version (`/mobile-app`)
- **Frontend**: A mirrored React frontend packaged into a native Android app using **Capacitor**.
- **Backend (Native Python)**: Uses **Chaquopy** to bundle the Python backend directly inside the Android app (`android/app/src/main/python`). 
- **Connection**: The mobile React frontend communicates with the native Python runtime synchronously via a custom Java Bridge (`chaquopyBridge`) calling FastAPI's `TestClient`. No external backend server is required! All Python logic runs directly on the user's phone.

### Shared Infrastructure
- **Database**: Both the web backend and the mobile native backend connect to a shared, centralized **PostgreSQL** instance hosted on Aiven.
- **Storage**: File uploads (Excel documents, CDAP PDFs, Images) bypass local filesystem constraints by uploading directly to **Google Drive** using a custom pure-python implementation (`requests` + `rsa`).

---

## 🚀 Recent Implementations & Fixes

1. **Native Python Mobile Backend**: Successfully packaged the backend inside the Android app. Solved critical "Server Unreachable" errors by rewriting the native Java bridge to route requests cleanly through FastAPI's `TestClient` object.
2. **Offline Mode Block**: Integrated `@capacitor/network` into the mobile app to actively monitor internet connectivity. If the device loses internet access, the app immediately blocks navigation and displays a "No Internet Connection" screen, preventing broken database calls.
3. **Google Drive Integration**: Rewrote the Google Drive Service API so that it relies purely on the standard Python `requests` library and `rsa`. This was done to bypass Android build errors caused by the standard `cryptography` library requiring a Rust compiler.
4. **Android Build Dependencies**: Configured `build.gradle` to automatically install essential backend packages like `fastapi`, `pydantic-settings`, and `python-jose`. Replaced C-based `bcrypt` with a pure-python `passlib` fallback to guarantee smooth mobile compilation.
5. **UI Polish**: Cleaned up the `Settings.tsx` interface and removed the confusing "Connection Settings" block, as the Mobile App natively routes to its internal server and does not need a URL.
6. **Question Bank MCQ Generation**: Resolved an inheritance bug in `INDIVIDUAL FULL CONFIG` mode where the router failed to pass through the correct `mcqCount` to per-unit generators. Added fallback inheritance from global parts data.
7. **AI LLM Provider Upgrades**: Switched the primary Groq model to `llama-3.3-70b-versatile` to scale past the low 8,000 TPM limit of previous models. Configured HTTP 413 errors to trigger automatic LLM provider fallback.
8. **Email Branding & Logo Layout**: Standardized the visual logo across all HTML transactional email templates so the gradient pill fully covers the entire "Krish Academia" text. Removed the redundant word "System" from automated email share notifications.

---

## 🛠️ How to Run and Test

### 📱 Mobile App
Please refer to the dedicated [MOBILE_APP_GUIDE.md](MOBILE_APP_GUIDE.md) for full instructions on building, running, and syncing the native Android app using Capacitor and Chaquopy.

### 🌐 Web Application
To run the Web Application locally:

1. **Start the Backend:**
```bash
cd backend-python
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

2. **Start the Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## 🔑 Environment Variables
All secret keys and credentials (including Google Drive Service Account JSON) are securely tracked and loaded dynamically by Pydantic. If you need to update them, check the `.env` file located inside `mobile-app/android/app/src/main/python/`.

---

## 📡 Supported AI Providers
The platform supports real-time swapping and custom API key configuration for the following providers via the Settings tab:
- **Cerebras**: Ultra-fast wafer-scale inference.
- **Groq**: LPU architecture for near-instant Llama generation.
- **NVIDIA NIM**: High-quality enterprise LLMs.
- **OpenRouter**: Access to numerous open-source models dynamically.

---

## 📄 License
MIT © 2026 Krish Academia
