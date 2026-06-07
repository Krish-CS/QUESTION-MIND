# Chaquopy Migration Plan: Python Native Backend for Mobile

## 🎯 Current → Target Architecture

### Current (Pyodide/WASM)
```
React Native UI
    ↓ (JSON)
pyodideBridge.ts
    ↓ (JavaScript→Python)
Pyodide (Python WASM)
    ↓
Python re-implementations (aiService.ts, etc)
    ↓
Local Files/IndexedDB
```

### Target (Chaquopy Native)
```
React Native UI (unchanged)
    ↓ (JSON via Capacitor)
Native Bridge (Java/Kotlin)
    ↓
Chaquopy (Native Python Runtime)
    ↓
Python Services (100% native - ai_service.py, excel_service.py, etc)
    ↓
SQLite + File Storage
```

---

## 📋 Migration Steps

### **Phase 1: Android Setup (Chaquopy)**

#### 1.1 Update `mobile-app/android/app/build.gradle`
- Add Chaquopy plugin and dependencies
- Set Python version to 3.11
- Configure native builds

#### 1.2 Create `mobile-app/android/src/main/java/com/questionmind/PythonBridge.kt`
- Java/Kotlin interface between React Native and Python
- Handle method calls from TypeScript
- Return JSON responses

#### 1.3 Create `mobile-app/android/src/main/python/`
- Port Python services from backend: `ai_service.py`, `excel_service.py`, `cdap_parser.py`
- Create `mobile_service.py` as entry point
- Configure local SQLite database path

### **Phase 2: Update React Native Bridge**

#### 2.1 Replace `pyodideBridge.ts` with `chaquopyBridge.ts`
- Use Capacitor plugin to call native Java methods
- Handle async/await on Python calls
- Implement fallback for offline scenarios

#### 2.2 Update `aiService.ts`
- Remove JavaScript AI logic
- Call native Python bridge instead
- Keep same API signature for compatibility

#### 2.3 Update `excelGenerator.ts`
- Call native `excel_service.py` via bridge
- Handle file downloads from native storage

### **Phase 3: Remove Pyodide**

#### 3.1 Clean up dependencies
- Remove `pyodide` from `package.json`
- Remove `pyodideBridge.ts`
- Remove `public/python/` WASM files

#### 3.2 Update Capacitor config
- Remove Pyodide loader
- Add Chaquopy plugin

---

## 🔧 Implementation Files to Create

### New Files
```
mobile-app/
├── android/
│   ├── app/
│   │   ├── build.gradle (MODIFY - add Chaquopy)
│   │   └── src/main/
│   │       ├── java/com/questionmind/
│   │       │   ├── PythonBridge.kt (NEW)
│   │       │   └── MainActivity.kt (MODIFY)
│   │       └── python/ (NEW)
│   │           ├── mobile_service.py (NEW)
│   │           ├── ai_service.py (COPY from backend)
│   │           ├── excel_service.py (COPY from backend)
│   │           ├── cdap_parser.py (COPY from backend)
│   │           ├── syllabus_parser.py (COPY from backend)
│   │           ├── models.py (COPY from backend)
│   │           ├── schemas.py (COPY from backend)
│   │           └── requirements.txt (NEW)
│   └── capacitor.settings.gradle (MODIFY)
│
└── src/
    └── lib/
        ├── chaquopyBridge.ts (NEW - replaces pyodideBridge.ts)
        ├── aiService.ts (MODIFY - call native Python)
        ├── excelGenerator.ts (MODIFY)
        └── parsers/
            └── pythonParsers.ts (NEW)

capacitor.config.ts (MODIFY - add Chaquopy plugin)
package.json (MODIFY - remove pyodide)
```

---

## 💾 Benefits

| Aspect | Pyodide (Current) | Chaquopy (Proposed) |
|--------|-------------------|-------------------|
| **Performance** | ~30-50% JS overhead | 100% native Python speed |
| **Memory** | WASM runtime + heap | Optimized native heap |
| **Library Support** | Limited (pure Python only) | Full NumPy, Pandas, etc |
| **Offline** | Works (fully local) | Works (fully local) |
| **Size** | 3-5 MB WASM | Native binary (optimized) |
| **AI Service** | JS reimplementation | Native Python (100% compatible) |

---

## 📦 Dependencies to Port

**From backend to mobile:**
- `requirements.txt` dependencies (openpyxl, pdf parsing, etc)
- `ai_service.py` (all 4 providers)
- `excel_service.py`
- `cdap_parser.py` + `syllabus_parser.py`
- `models.py` + `schemas.py` (data validation)

**New in Chaquopy:**
- `chaquopy` gradle plugin (handles Java↔Python)
- SQLite3 (built-in to Python)

---

## ⚠️ Important Notes

1. **One-way bridge**: React Native calls Python, Python doesn't call React Native
2. **JSON serialization**: All data must be JSON-serializable
3. **Async handling**: Long AI calls must be non-blocking
4. **Local SQLite**: Replace IndexedDB with SQLite for better performance
5. **iOS**: For now, iOS keeps Pyodide (or use same architecture with native Python)

---

## Next Steps

1. Review this plan
2. Start Phase 1: Update build.gradle with Chaquopy
3. Create PythonBridge.kt
4. Port Python services to `android/src/main/python/`
5. Implement chaquopyBridge.ts
6. Test end-to-end with question generation
7. Migrate storage from IndexedDB to SQLite

---

Would you like me to implement **Phase 1** now? I'll create:
1. Updated `build.gradle` with Chaquopy
2. `PythonBridge.kt` (Java↔Python bridge)
3. `chaquopyBridge.ts` (React Native↔Java bridge)
4. Python services setup in `android/src/main/python/`
