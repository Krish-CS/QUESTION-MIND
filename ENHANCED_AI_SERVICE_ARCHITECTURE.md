# Enhanced AI Service Architecture
## Custom API Keys + Local Models + Intelligent Fallback

---

## 🎯 Overview

Your AI service will support three modes:

1. **Backend API Keys** (default) - Groq, Cerebras, NVIDIA, OpenRouter
2. **User Custom Keys** (optional) - User provides their own API keys
3. **Local Models** (offline) - Device-native models like Gemma 2B (if supported)

**Flow:**
```
User clicks "Generate Questions"
    ↓
Check user preferences (API key / Local model)
    ↓
Try user's custom key if provided
    ↓ (fails)
Try backend keys in order
    ↓ (all fail)
Check if device supports local models
    ↓ (yes)
Run Gemma 2B locally
    ↓ (no or not installed)
Show error: "No providers available. Add API key or enable local model"
```

---

## 📋 Implementation Phases

### Phase 1: Backend Changes (Python FastAPI)

**New Features:**
- User API key storage (encrypted in DB)
- Local model capability detection
- Enhanced error messages
- New endpoints for settings

**Files to Modify:**
- `backend-python/app/config.py` → Add local model config
- `backend-python/app/models/user.py` → Add API key storage
- `backend-python/app/services/ai_service.py` → Add custom key & local model logic
- `backend-python/app/services/local_model_service.py` → NEW (Ollama/local inference)
- `backend-python/app/routers/ai_settings.py` → NEW (API key management)

**Key Changes:**
```python
# ai_service.py changes:
- __init__(self, user_id: str = None, custom_api_key: str = None)
- Check custom key first, then backend keys, then local models
- Detailed error messages: which providers failed, why
- LocalModelService integration

# new ai_settings.py:
- POST /settings/api-key (user provides custom key)
- DELETE /settings/api-key (remove custom key)
- GET /settings/providers (available providers + status)
- GET /settings/device-capabilities (can device run Gemma 2B?)
```

---

### Phase 2: Frontend (Web) Changes

**New UI Components:**
1. **Settings Page** (new or expanded)
   - API Key input field (with encryption notice)
   - Toggle for "Use Custom Key" vs "Use Backend Keys"
   - Local Model section (with device capability check)
   - Provider status indicator

2. **Sidebar Enhancement**
   - New "AI Settings" menu item
   - "Provider Status" quick view
   - "Switch Provider" dropdown (if multiple available)

3. **Question Generation Dialog**
   - Show which provider will be used
   - Better error messages with fallback suggestions
   - "Try different provider" button
   - "Add custom API key" shortcut link

**Files to Create/Modify:**
- `frontend/src/pages/Settings.tsx` → NEW or expanded
- `frontend/src/components/ProviderSelector.tsx` → NEW
- `frontend/src/components/ApiKeyInput.tsx` → NEW
- `frontend/src/lib/settingsStore.ts` → NEW (Zustand store for AI settings)
- `frontend/src/lib/api.ts` → Add AI settings endpoints

**UI Flow:**
```
Main Dashboard
    ↓
Sidebar: Menu (three dots)
    ├─ Subjects
    ├─ Syllabi
    ├─ Question Banks
    ├─ [NEW] AI Settings
    └─ [NEW] Provider Status
        
AI Settings Page
    ├─ Custom API Keys section
    │   ├─ Input field
    │   ├─ Test connection button
    │   └─ Status indicator
    ├─ Local Model section
    │   ├─ Device capability check
    │   ├─ Model selector (if supported)
    │   └─ Install/Download button
    └─ General Settings
        ├─ Preferred provider
        ├─ Fallback strategy
        └─ Error notifications
```

---

### Phase 3: Mobile App Changes (React Native)

**Same as web, but optimized for mobile:**
- Settings screen (accessible from main menu)
- Bottom sheet for provider selection
- Compact API key input
- Local model availability check (Android Chaquopy integration)

**Files to Create/Modify:**
- `mobile-app/src/pages/Settings.tsx` → Update with new options
- `mobile-app/src/components/ProviderSelector.tsx` → NEW
- `mobile-app/src/components/ApiKeyInput.tsx` → NEW
- `mobile-app/src/lib/settingsStore.ts` → NEW
- `mobile-app/android/src/main/python/local_model_service.py` → NEW (Chaquopy)

---

## 🏗️ Backend Architecture

### New Database Schema

```sql
-- Add to user table
ALTER TABLE users ADD COLUMN custom_api_key VARCHAR(500) ENCRYPTED;
ALTER TABLE users ADD COLUMN preferred_provider VARCHAR(50);
ALTER TABLE users ADD COLUMN enable_local_models BOOLEAN DEFAULT FALSE;
```

### New Models (Python)

```python
class APIKeySettings(BaseModel):
    provider: str  # "custom", "groq", "cerebras", "nvidia", "openrouter"
    api_key: str  # encrypted
    created_at: datetime
    last_used: datetime

class LocalModelConfig(BaseModel):
    model_name: str  # "gemma2b", "llama2"
    device_supported: bool
    installed: bool
    download_progress: Optional[float]
```

### New API Endpoints

**Settings Management:**
```
POST   /api/ai-settings/api-key            # Save custom API key
DELETE /api/ai-settings/api-key            # Remove custom API key
GET    /api/ai-settings/status             # Provider availability
GET    /api/ai-settings/local-models       # Device capability check
POST   /api/ai-settings/test-key           # Test custom API key
```

**Question Generation (Enhanced):**
```
POST   /api/question-banks/generate        # Now supports:
                                           # - provider_preference
                                           # - fallback_strategy
                                           # - use_local_model
```

### Error Response Format

```json
{
  "success": false,
  "error": "All AI providers exhausted",
  "details": {
    "providers_tried": [
      {
        "name": "custom_key",
        "status": "failed",
        "error": "Invalid API key"
      },
      {
        "name": "groq",
        "status": "failed", 
        "error": "Rate limited (429)"
      },
      {
        "name": "cerebras",
        "status": "failed",
        "error": "Invalid model"
      }
    ],
    "fallback_options": [
      "Add your own API key",
      "Install local model Gemma2B (requires 2GB RAM)"
    ]
  },
  "next_steps": [
    {
      "action": "add_api_key",
      "label": "Add Custom API Key",
      "url": "/settings/ai"
    },
    {
      "action": "enable_local_model",
      "label": "Enable Offline Mode",
      "url": "/settings/ai/local-models"
    }
  ]
}
```

---

## 💾 Frontend State Management

### New Zustand Store: `settingsStore.ts`

```typescript
interface AISettings {
  // User's custom API key (stored in localStorage)
  customApiKey: string | null;
  
  // User's provider preferences
  preferredProvider: 'backend' | 'custom' | 'local';
  
  // Local model settings
  localModelsEnabled: boolean;
  deviceCapabilities: {
    supportsGemma2B: boolean;
    ram_gb: number;
    storage_gb: number;
  };
  
  // Current provider status
  providerStatus: {
    [provider: string]: 'available' | 'limited' | 'unavailable' | 'error';
  };
  
  // Settings UI state
  showApiKeyInput: boolean;
  showProviderSelector: boolean;
  lastError: string | null;
}
```

---

## 🔄 Fallback Strategy

**Default Chain:**
```
1. User's custom API key (if provided)
2. Backend primary key (Cerebras 1)
3. Backend secondary key (Cerebras 2)
4. Groq
5. NVIDIA
6. OpenRouter
7. Local model (if device supports & user enabled)
8. Show error with fallback options
```

**User Can Override:**
- "Prefer local model" → Skip to #7
- "Test with Groq first" → Reorder chain
- "Add my key" → Insert at position #1

---

## 🔐 Security Considerations

1. **API Keys in Transit:**
   - All HTTPS
   - Encrypted request body

2. **API Keys at Rest:**
   - Encrypted in database
   - Never logged
   - Never shown in UI (masked)

3. **Local Models:**
   - Downloaded to secure app storage
   - Not shared with other apps
   - User consent required

---

## 📊 UI Mockup - Settings Page

```
Settings > AI & Models
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔑 API Keys
┌─────────────────────────────┐
│ Custom API Key              │
│ [ ··········· (masked) ]    │
│ ✓ Connected                 │
│ [Remove]  [Test]            │
└─────────────────────────────┘

⚙️  Provider Preferences
┌─────────────────────────────┐
│ ◎ Use Backend Keys          │
│ ◎ Use Custom Key (if set)   │
│ ◎ Prefer Local Model        │
└─────────────────────────────┘

📱 Device Capabilities
┌─────────────────────────────┐
│ Local Models: Not Supported │
│ RAM: 4 GB                   │
│ Storage: 32 GB available    │
│ (Gemma2B needs 2GB + 2GB)   │
└─────────────────────────────┘

🔄 Provider Status
┌─────────────────────────────┐
│ Groq             ✓ Ready    │
│ Cerebras         ✓ Ready    │
│ NVIDIA           ✓ Ready    │
│ OpenRouter       ✗ No key   │
│ Local Model      ⚠ Not set  │
└─────────────────────────────┘

[Save]  [Cancel]
```

---

## 📱 Mobile UI (React Native)

```
Main Menu
├─ Dashboard
├─ Subjects
├─ Syllabi
├─ Question Banks
├─ [NEW] AI Settings
└─ Staff Assignments

AI Settings Screen
├─ 🔑 Add API Key
│  ├─ Input field (secure)
│  ├─ Test button
│  └─ Remove option
├─ ⚙️ Provider Preference
│  ├─ Radio: Use Backend
│  ├─ Radio: Use Custom
│  └─ Radio: Use Local
├─ 📱 Local Model
│  ├─ Device check
│  ├─ Status
│  └─ Install button (if available)
└─ 🔄 Provider Status
   ├─ List of available providers
   └─ Error indicators
```

---

## 🧬 Code Locations Summary

### Backend (Python)
```
backend-python/app/
├── config.py                          (MODIFY - add local model config)
├── models/
│   ├── user.py                       (MODIFY - add API key field)
│   └── ai_settings.py                (NEW - API key models)
├── services/
│   ├── ai_service.py                 (MODIFY - custom key + local model logic)
│   └── local_model_service.py        (NEW - Ollama/local inference)
└── routers/
    └── ai_settings.py                (NEW - settings endpoints)
```

### Frontend (Web)
```
frontend/src/
├── pages/
│   └── Settings.tsx                  (NEW or MODIFY)
├── components/
│   ├── ProviderSelector.tsx          (NEW)
│   ├── ApiKeyInput.tsx               (NEW)
│   └── ProviderStatus.tsx            (NEW)
├── lib/
│   ├── settingsStore.ts              (NEW)
│   └── api.ts                        (MODIFY - add settings endpoints)
```

### Mobile App (React Native)
```
mobile-app/
├── src/
│   ├── pages/
│   │   └── Settings.tsx              (MODIFY - add AI settings)
│   ├── components/
│   │   ├── ProviderSelector.tsx      (NEW)
│   │   ├── ApiKeyInput.tsx           (NEW)
│   │   └── LocalModelInstaller.tsx   (NEW)
│   └── lib/
│       ├── settingsStore.ts          (NEW)
│       └── api.ts                    (MODIFY)
└── android/src/main/python/
    ├── local_model_service.py        (NEW - with Chaquopy)
    └── mobile_service.py             (MODIFY - support custom keys)
```

---

## 🔄 User Flow Diagrams

### User Provides Custom API Key
```
User Settings → Add API Key
    ↓
Enter key (masked input)
    ↓
Click "Test Connection"
    ↓
Backend validates with provider
    ↓
✅ Success → Save & Show "Ready to Use"
❌ Failed → Show error "Invalid key for provider XYZ"
```

### Device Doesn't Support Local Model
```
Generate Questions
    ↓
Try custom key → Fail
    ↓
Try backend keys → All fail
    ↓
Check device capability → Not supported
    ↓
Show: "Add API key or use web version for larger models"
```

### Local Model Option Available
```
Generate Questions
    ↓
Try custom key → Fail
    ↓
Try backend keys → All fail
    ↓
Check device capability → Supported!
    ↓
Offer: "Run Gemma2B locally? (No internet needed)"
    ↓
User clicks "Download & Run"
    ↓
Download model (if not already there)
    ↓
Run generation locally
    ↓
✅ Success
```

---

## 🎬 Implementation Order

1. **Backend (2-3 days)**
   - Modify `ai_service.py` to accept custom keys
   - Add local model service (Ollama wrapper)
   - Create new settings endpoints
   - Update database schema

2. **Frontend Web (2-3 days)**
   - Create Settings page
   - Implement API key input
   - Add provider selector
   - Integrate error handling

3. **Frontend Mobile (2 days)**
   - Port React code to React Native
   - Add device capability detection
   - Integrate with Chaquopy if needed

4. **Testing (1-2 days)**
   - Test each provider chain
   - Test error scenarios
   - Test local model integration

---

## ✅ Success Criteria

- ✓ User can input custom API key
- ✓ System tries custom key first, then backend, then local
- ✓ Device capability properly detected
- ✓ Clear error messages show available options
- ✓ UI allows switching between providers
- ✓ Settings persist across sessions
- ✓ Works on web and mobile identically
- ✓ Local model works offline (if device supports)

---

## 📞 Dependencies

**Python Backend:**
- `cryptography` (for API key encryption)
- `ollama` or `langchain` (for local model support)

**Frontend:**
- No new major dependencies (uses existing Zustand, Lucide icons)

**Mobile:**
- Same as web + Chaquopy (already planned)

---

This architecture ensures:
✅ **Flexibility**: Users can use backend, custom, or local models
✅ **Resilience**: Automatic fallback through the chain
✅ **Transparency**: Clear error messages show what's available
✅ **Security**: Encrypted keys, no logging
✅ **Consistency**: Same behavior web & mobile
