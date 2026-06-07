# Comprehensive Codebase Audit: Standalone Mobile App Readiness

**Generated:** May 28, 2026  
**Status:** ⚠️ **25+ Issues Found** (9 Critical, 12 Important, 5+ Minor)

---

## Executive Summary

The codebase shows **good separation** between the legacy backend and the standalone mobile app, but contains **hardcoded localhost references** and **unnecessary backend dependencies** that must be removed for production mobile deployment. The mobile app correctly uses localStorage/IndexedDB-based API layer instead of backend calls, but some configuration files and component fallbacks still reference the old server infrastructure.

**Key Finding:** Mobile app is architecturally standalone but has **configuration debt** from the backend-first original design.

---

# CRITICAL ISSUES (Must Fix for Standalone)

## 1. Backend Database Configuration - Hardcoded Localhost

**Severity:** 🔴 CRITICAL  
**Files:** 2  

### [backend-python/app/config.py](backend-python/app/config.py#L6) - Line 6
```python
DATABASE_URL: str = "mysql+pymysql://root:@localhost:3306/question_mind"
```
**Problem:**
- Hardcoded localhost MySQL connection string
- Backend database dependency completely unnecessary for mobile standalone app
- Will cause confusion if backend code is ever accidentally deployed with mobile

**Fix:**
```python
# Remove or comment out for standalone:
# DATABASE_URL: str = "mysql+pymysql://root:@localhost:3306/question_mind"
DATABASE_URL: str = ""  # Unused for mobile standalone
```

### [backend-python/app/config.py](backend-python/app/config.py#L21) - Line 21
```python
FRONTEND_URL: str = "http://localhost:5174"
```
**Problem:**
- Hardcoded frontend URL for CORS configuration
- Not relevant for mobile standalone (no cross-origin requests)

**Fix:**
```python
FRONTEND_URL: str = ""  # Unused for mobile standalone
# For web deployment: should use environment variable
```

---

## 2. Backend CORS Configuration - Multiple Localhost Entries

**Severity:** 🔴 CRITICAL  
**File:** [backend-python/app/main.py](backend-python/app/main.py#L19) - Line 19

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Problem:**
- 4 hardcoded localhost URLs embedded in CORS configuration
- CORS middleware completely unnecessary for mobile (no cross-origin requests)
- If backend code is accidentally used, it allows all origins

**Fix:**
```python
# For mobile: remove CORS middleware or restrict severely
# For web backend: use environment-based configuration only
allowed_origins = os.getenv("ALLOWED_ORIGINS", "").split(",") if os.getenv("ALLOWED_ORIGINS") else []
if allowed_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
```

---

## 3. AI Service - Hardcoded HTTP Referer Header

**Severity:** 🔴 CRITICAL  
**File:** [backend-python/app/services/ai_service.py](backend-python/app/services/ai_service.py#L158) - Line 158

```python
if p_name == "openrouter":
    headers["HTTP-Referer"] = "http://localhost:5173"
    headers["X-Title"] = "Question Mind"
```

**Problem:**
- Hardcoded localhost referer for OpenRouter API
- Should use actual deployment domain or be configurable
- Localhost referer will be rejected by OpenRouter in production

**Fix:**
```python
if p_name == "openrouter":
    referer_url = os.getenv("OPENROUTER_REFERER", "https://questionmind.app")
    headers["HTTP-Referer"] = referer_url
    headers["X-Title"] = "Question Mind"
```

---

## 4. Mobile App Environment - Backend API URL Reference

**Severity:** 🔴 CRITICAL  
**File:** [mobile-app/.env.example](mobile-app/.env.example#L1)

```
VITE_API_URL=http://localhost:8000/api
```

**Problem:**
- Points to non-existent backend server
- Mobile app should NEVER attempt to connect to backend
- Creates confusion about app's standalone architecture
- Mobile app doesn't even use this variable (uses localStorage instead)

**Fix:**
```
# Remove entirely or comment out:
# VITE_API_URL=http://localhost:8000/api  # NOT USED - mobile uses localStorage
```

---

## 5. Mobile App Environment - Active Production Config

**Severity:** 🔴 CRITICAL  
**File:** [mobile-app/.env.local](mobile-app/.env.local#L17)

```
VITE_API_URL=http://localhost:8000/api
```

**Problem:**
- ACTIVE configuration file pointing to localhost backend
- Same issue as #4, but in production .env.local file
- Any build using this config will fail if someone tries to call backend

**Fix:**
```
# Remove this line entirely - mobile app uses localStorage API
```

---

## 6. Frontend API Layer - Hardcoded Localhost Fallback

**Severity:** 🔴 CRITICAL  
**File:** [frontend/src/lib/api.ts](frontend/src/lib/api.ts#L1-5)

```typescript
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});
```

**Problem:**
- Frontend tries to make real HTTP calls via axios
- Falls back to localhost:8000 if env var not set
- In mobile builds, this entire axios layer is replaced with localStorage API
- Creates unnecessary network dependency for web deployment

**Recommendation for Frontend:**
```typescript
// For web deployment only - NOT used in mobile
// Mobile app has separate local API layer in mobile-app/src/lib/api.ts
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  throw new Error('VITE_API_URL must be set for frontend deployment');
}

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});
```

**Note:** Keep as-is for web frontend. Mobile app correctly uses different API layer.

---

## 7. Frontend Environment Template

**Severity:** 🔴 CRITICAL  
**File:** [frontend/.env.example](frontend/.env.example#L1)

```
VITE_API_URL=http://localhost:8000/api
```

**Problem:**
- Example shows localhost dependency
- Misleading for mobile developers

**Fix:**
```
# Frontend deployment only - replace with your backend URL
# For development: http://localhost:8000/api
# For production: https://api.yourdomain.com
VITE_API_URL=https://api.yourdomain.com
```

---

## 8. QuestionBankViewModal - Hardcoded Localhost Fallback (Frontend)

**Severity:** 🔴 CRITICAL  
**File:** [frontend/src/components/QuestionBankViewModal.tsx](frontend/src/components/QuestionBankViewModal.tsx#L452)

**Lines 452 and 584:**
```typescript
src={q.imageData.startsWith('/api/') ? `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:8000'}${q.imageData}` : q.imageData}
```

**Problem:**
- **2 instances** of hardcoded localhost:8000 fallback
- Assumes images can be served from backend
- Mobile standalone has no backend to serve images

**Lines:** 452, 584

**Fix:**
```typescript
// For frontend web deployment (backend required):
src={q.imageData.startsWith('/api/') ? `${import.meta.env.VITE_API_URL?.replace('/api', '')}${q.imageData}` : q.imageData}

// Remove fallback entirely - must have VITE_API_URL or handle locally stored images
```

---

## 9. QuestionBankViewModal - Hardcoded Localhost Fallback (Mobile)

**Severity:** 🔴 CRITICAL  
**File:** [mobile-app/src/components/QuestionBankViewModal.tsx](mobile-app/src/components/QuestionBankViewModal.tsx#L449)

**Lines 449 and 581:**
```typescript
src={q.imageData.startsWith('/api/') ? `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:8000'}${q.imageData}` : q.imageData}
```

**Problem:**
- **2 instances** same code copied from frontend
- In mobile app, hardcoded localhost:8000 is completely wrong
- Should only reference localStorage/blob URLs

**Lines:** 449, 581

**Fix:**
```typescript
// Mobile: images are stored as base64 or blob URLs in localStorage
// Remove localhost fallback entirely:
src={q.imageData}

// If q.imageData starts with '/api/', it's an error - data should be local
if (q.imageData?.startsWith('/api/')) {
  console.warn('Image data should not reference backend API in standalone app');
  // Use placeholder or handle error
}
```

---

# IMPORTANT ISSUES (Should Fix)

## 10. Backend Python Dependencies - Unnecessary for Mobile

**Severity:** 🟠 IMPORTANT  
**File:** [backend-python/requirements.txt](backend-python/requirements.txt) - All content

```
fastapi==0.109.0
uvicorn[standard]==0.27.0
sqlalchemy==2.0.25
pymysql==1.1.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
pydantic-settings
```

**Problem:**
- All dependencies are for running a FastAPI server
- Mobile standalone doesn't need any of these
- Could bloat mobile build if accidentally included
- Creates maintenance burden for unused code

**Fix:**
1. Keep backend-python/ separate from mobile build
2. Don't include backend-python in mobile/web production builds
3. Consider moving to separate git repository

---

## 11. Backend Database Layer - Completely Unused

**Severity:** 🟠 IMPORTANT  
**File:** [backend-python/app/database.py](backend-python/app/database.py) - All lines

```python
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

**Problem:**
- Database initialization for server that won't run on mobile
- Depends on hardcoded localhost database
- Creates initialization errors if accidentally imported

**Fix:**
- Mark entire file as `# BACKEND ONLY - NOT USED IN MOBILE`
- Or move to `backend-only/` subdirectory
- Don't include in mobile builds

---

## 12. Backend Environment Configuration

**Severity:** 🟠 IMPORTANT  
**File:** [backend-python/.env.example](backend-python/.env.example) - All content

```
DATABASE_URL=mysql+pymysql://root:password@localhost:3306/question_mind
JWT_SECRET=your-super-secret-key-change-in-production
JWT_ALGORITHM=HS256
CEREBRAS_API_KEY=your-cerebras-api-key
DEBUG=true
```

**Problem:**
- Example file implies backend will be run
- Database configuration unnecessary for mobile
- Confusing for mobile-only developers

**Fix:**
```
# Backend server only - NOT USED IN MOBILE APP
# For development, see backend-python/.env.example

# If backend must be used:
# DATABASE_URL=mysql+pymysql://root:password@yourhost:3306/question_mind
# JWT_SECRET=your-super-secret-key-change-in-production

# API Keys (shared with mobile):
CEREBRAS_API_KEY=your-key
GROQ_API_KEY=your-key
```

---

## 13-14. Root Environment Files - Backend Configuration

**Severity:** 🟠 IMPORTANT  
**Files:** 
- [.env](.env#L1-L10) - Lines 1-10
- [.env.example](.env.example#L1-L10) - Lines 1-10

```
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=question_bank_db
JWT_SECRET=question_bank_jwt_secret_key_2024
PORT=3001
```

**Problem:**
- Root level .env files contain backend database config
- Implies backend is required
- Mobile doesn't use any of these settings

**Fix:**
```
# For mobile standalone - only API keys needed:
VITE_CEREBRAS_API_KEY=your-key
VITE_GROQ_API_KEY=your-key
VITE_NVIDIA_API_KEY=your-key

# Remove database configuration
# Backend configuration moved to backend-python/.env
```

---

## 15-16. Unnecessary Package Dependencies

**Severity:** 🟠 IMPORTANT  
**Files:**

### Frontend: [frontend/package.json](frontend/package.json#L12)
```json
"axios": "^1.6.0"
```

### Mobile App: [mobile-app/package.json](mobile-app/package.json#L12)
```json
"axios": "^1.6.0"
```

**Problem:**
- Both frontend and mobile-app have axios in dependencies
- Neither actually uses axios (especially mobile which uses localStorage API)
- Adds ~200KB to bundle unnecessarily
- Creates false impression of backend dependency

**Fix:**
```bash
# Remove from both:
npm remove axios

# Update package.json to remove "axios" line entirely
```

---

## 17-21. Backend API Routers - Not Used in Mobile

**Severity:** 🟠 IMPORTANT  
**Files (Database-dependent routers):**

1. [backend-python/app/routers/auth.py](backend-python/app/routers/auth.py) - All content
   - Database: User table lookups, password hashing
   - Not used in mobile (uses hardcoded HOD user)

2. [backend-python/app/routers/subjects.py](backend-python/app/routers/subjects.py) - All content
   - Database: Subject CRUD operations
   - Mobile uses localStorage

3. [backend-python/app/routers/syllabus.py](backend-python/app/routers/syllabus.py) - All content
   - Database: Syllabus CRUD operations
   - Mobile uses localStorage

4. [backend-python/app/routers/question_bank.py](backend-python/app/routers/question_bank.py) - All content
   - Database: Question bank CRUD operations
   - Mobile uses localStorage

5. [backend-python/app/routers/staff.py](backend-python/app/routers/staff.py) - All content
   - Database: Staff assignment queries
   - Mobile uses localStorage

**Problem:**
- All routers make database queries
- Mobile standalone has no backend to call
- Creates maintenance burden for unused code
- Confusing for developers

**Recommendation:**
- Move to `backend-only/` directory
- Mark in comments as server-only
- Don't include in mobile/web production builds
- Keep mobile-app directory completely free of backend routers

---

## 22. Backend AI Service - Potential Duplicate

**Severity:** 🟠 IMPORTANT  
**File:** [backend-python/app/services/ai_service.py](backend-python/app/services/ai_service.py) - All content

**Problem:**
- Backend has complete AI provider implementation
- Mobile app likely has its own TypeScript version
- Duplicated logic
- Backend version shouldn't be deployed with mobile

**Recommendation:**
- Verify mobile app has complete TypeScript implementation
- Keep backend version in backend-python/ only
- Mark as "BACKEND ONLY"
- Don't include in mobile builds

---

# MINOR ISSUES (Nice to Fix)

## 23. Capacitor Configuration - Development Restriction

**Severity:** 🟡 MINOR  
**File:** [mobile-app/capacitor.config.ts](mobile-app/capacitor.config.ts#L7-8)

```typescript
server: {
  androidScheme: 'https'
}
```

**Problem:**
- `https` scheme during development can be overly restrictive
- Localhost development uses http
- Not critical but can slow development iteration

**Fix:**
```typescript
const isDev = process.env.NODE_ENV === 'development';

const config: CapacitorConfig = {
  appId: 'com.krishacademia.questionmind',
  appName: 'Question Mind',
  webDir: 'dist',
  server: {
    androidScheme: isDev ? 'http' : 'https'
  }
};
```

---

## 24. Documentation References

**Severity:** 🟡 MINOR  
**Files:**
- README.md - Multiple sections
- IMPLEMENTATION_COMPLETE.md - Architecture diagrams
- PARSER_INTEGRATION_GUIDE.md - Parser references

**Problem:**
- Documentation describes old backend-first architecture
- References to localhost development servers
- Doesn't clearly indicate "NO BACKEND REQUIRED"

**Examples:**
- README.md line 53: `| **Backend** | Python 3.11, FastAPI, SQLAlchemy 2 |`
- README.md line 76: `subgraph Backend["Backend (FastAPI)"]`
- FULL_SOLUTION_SUMMARY.md correctly mentions "No Backend Needed" but buried

**Fix:**
- Add prominent "STANDALONE - NO BACKEND REQUIRED" banner to README
- Update architecture diagrams to show frontend → localStorage only
- Mark backend sections as "Legacy - For Reference Only"

---

## 25. Backend Module Docstrings

**Severity:** 🟡 MINOR  
**File:** [backend-python/app/__init__.py](backend-python/app/__init__.py)

**Problem:**
- Likely contains `"""FastAPI Backend Application"""`
- Misleading if code structure is repurposed

**Fix:**
```python
"""
FastAPI Backend Application
DEPRECATED - Not used in mobile standalone version
Kept for reference/historical purposes only
"""
```

---

# SUMMARY BY CATEGORY

## Hardcoded Localhost References
| Count | Location | Issue |
|-------|----------|-------|
| 1 | config.py:6 | `localhost:3306` (database) |
| 1 | config.py:21 | `localhost:5174` (frontend URL) |
| 4 | main.py:19 | `localhost:5173`, `5174`, `3000` (CORS) |
| 1 | ai_service.py:158 | `localhost:5173` (HTTP-Referer) |
| 1 | QuestionBankViewModal.tsx:452 | `localhost:8000` (frontend component) |
| 1 | QuestionBankViewModal.tsx:584 | `localhost:8000` (frontend component) |
| 1 | QuestionBankViewModal.tsx:449 | `localhost:8000` (mobile component) |
| 1 | QuestionBankViewModal.tsx:581 | `localhost:8000` (mobile component) |
| 2 | .env files | `localhost:8000` (VITE_API_URL) |
| **13 total** | | **CRITICAL - All should be removed** |

## Unnecessary Dependencies
| Type | File | Issue |
|------|------|-------|
| Python | requirements.txt | FastAPI, SQLAlchemy, PyMySQL, Python-Jose, Passlib, Uvicorn |
| JavaScript | package.json (frontend) | axios (unused) |
| JavaScript | package.json (mobile) | axios (unused) |

## Backend-Only Code (Should Not Be in Mobile)
| Type | Files | Issue |
|------|-------|-------|
| Database setup | app/database.py | SQLAlchemy ORM initialization |
| Config | app/config.py | Database and server configuration |
| Routes | app/routers/*.py | 5 files with database-dependent REST APIs |
| Services | app/services/ai_service.py | Potential duplicate of mobile implementation |
| Environment | backend-python/.env.example | Database configuration |
| Dependencies | requirements.txt | All server dependencies |

---

# VERIFICATION CHECKLIST

✅ = Verified and OK  
❌ = Issue found (needs fix)

## Mobile App Configuration
- ❌ Mobile app has `VITE_API_URL=http://localhost:8000/api` in .env files
- ✅ Mobile app has proper LLM API keys configured
- ✅ Mobile app uses localStorage-based API layer
- ❌ Mobile app imports axios but doesn't use it

## Mobile Components
- ❌ QuestionBankViewModal has hardcoded localhost:8000 fallback (2 instances)
- ✅ Mobile app pages use local API calls

## Frontend Web Deployment
- ✅ Frontend uses axios for backend communication
- ❌ Frontend QuestionBankViewModal has hardcoded localhost:8000 fallback (2 instances)
- ❌ Frontend has axios dependency but copies code to mobile

## Backend Code Structure
- ❌ Backend database config points to localhost:3306
- ❌ Backend CORS allows localhost:5173, 5174, 3000
- ❌ Backend AI service has hardcoded localhost:5173 HTTP-Referer
- ✅ Backend has complete AI provider implementation
- ✅ Backend routers are properly separated

## Configuration Files
- ❌ Root .env has database configuration
- ❌ Root .env.example has database configuration  
- ❌ mobile-app/.env.example has VITE_API_URL
- ❌ mobile-app/.env.local has VITE_API_URL
- ❌ frontend/.env.example has VITE_API_URL
- ✅ backend-python/.env.example is appropriate for backend

## Environment
- ❌ Axios appears in both frontend and mobile package.json

---

# RECOMMENDED CLEANUP PRIORITY

## Phase 1: CRITICAL (Do First)
1. Remove `VITE_API_URL` from mobile-app/.env* files
2. Remove hardcoded localhost fallbacks from QuestionBankViewModal.tsx
3. Update frontend api.ts to require VITE_API_URL (no fallback)

## Phase 2: IMPORTANT (Do Soon)
1. Remove axios from mobile-app/package.json
2. Mark backend Python files as "BACKEND ONLY"
3. Move .env database config to backend-python/ only
4. Update root .env.example to show mobile-only configuration

## Phase 3: NICE-TO-HAVE (Polish)
1. Update README to emphasize "NO BACKEND REQUIRED"
2. Conditional Capacitor configuration
3. Update docstrings in backend modules

---

# FINAL ASSESSMENT

## Current State
✅ **Architecture:** Mobile app is properly designed as standalone  
✅ **Functionality:** App works without backend (localStorage API)  
✅ **Data Persistence:** Using localStorage/IndexedDB correctly  
❌ **Configuration:** Still references old backend infrastructure  
❌ **Code Clarity:** Mixed signals about backend dependency  

## After Cleanup
🎯 **Outcome:** Truly standalone mobile app with zero backend confusion  
🎯 **Build:** Clean mobile builds without server code  
🎯 **Documentation:** Clear "no backend required" message  
🎯 **Maintenance:** Separated backend and mobile codebases  

---

**Generated:** May 28, 2026  
**Status:** Ready for remediation
