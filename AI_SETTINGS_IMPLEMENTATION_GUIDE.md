# AI Settings Implementation - Integration Guide

## 📦 Files Created

### Backend Python (FastAPI)

1. **`backend-python/app/services/enhanced_ai_service.py`**
   - Enhanced AI service with custom API key support
   - Multi-provider fallback chain
   - Local model integration
   - Detailed error tracking for user feedback

2. **`backend-python/app/services/local_model_service.py`**
   - Local model service for on-device inference
   - Supports Gemma2B, Llama2, Mistral
   - Device capability detection
   - Ollama endpoint support for web

3. **`backend-python/app/routers/ai_settings.py`**
   - API endpoints for:
     - Saving/deleting custom API keys (encrypted)
     - Testing API keys
     - Getting provider status
     - Device capabilities
     - User preferences
     - Local model downloads

### Frontend React Web

1. **`frontend/src/lib/settingsStore.ts`**
   - Zustand store for AI settings state
   - Persistent storage (localStorage) for preferences
   - UI state management (modals, loading states, test results)

2. **`frontend/src/lib/aiSettingsApi.ts`**
   - API client for AI settings endpoints
   - Wrapper functions for all backend endpoints
   - Error handling

3. **`frontend/src/components/ProviderSelector.tsx`**
   - Radio button selector for:
     - Backend Keys
     - Custom API Key
     - Local Model
   - Shows device capabilities and resource requirements

4. **`frontend/src/components/ApiKeyInput.tsx`**
   - Secure API key input with:
     - Password reveal toggle
     - Provider selection
     - Optional label
     - Key testing functionality
     - Saved key display with masked value
     - Delete button

5. **`frontend/src/pages/Settings.tsx`**
   - Full settings page with two tabs:
     - **General**: Provider selector, API key input, provider status
     - **Advanced**: Local model management, advanced options, rate limits info
   - Refresh provider status
   - Download local models
   - Provider status display

## 🔗 Integration Steps

### Step 1: Register Router in FastAPI App

Add to `backend-python/app/main.py`:

```python
from app.routers import ai_settings

# In app creation section:
app.include_router(ai_settings.router)
```

### Step 2: Add Routes to React Router

Add to `frontend/src/App.tsx`:

```typescript
import { Settings } from './pages/Settings';

// In your route definition:
<Route path="/settings" element={<Settings />} />
<Route path="/settings/ai" element={<Settings />} />
```

### Step 3: Add Menu Item to Sidebar

Modify `frontend/src/components/Layout.tsx`:

```typescript
// Add this menu item to your sidebar
{
  label: 'AI Settings',
  icon: Settings,
  href: '/settings',
  visible: isAuthenticated
}
```

### Step 4: Update Existing Question Generation

Modify `backend-python/app/routers/question_bank.py`:

```python
from app.services.enhanced_ai_service import EnhancedAIService
from app.models.user import User

@router.post("/generate")
async def generate_questions(
    request: GenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Get user preferences
    custom_key = getattr(current_user, 'custom_api_key', None)
    user_pref = getattr(current_user, 'preferred_provider', 'backend')
    enable_local = getattr(current_user, 'enable_local_models', False)
    
    # Create service with user context
    service = EnhancedAIService(
        user_id=current_user.id,
        custom_api_key=custom_key,
        user_preference=user_pref,
        enable_local_models=enable_local
    )
    
    try:
        questions = await service.generate_questions(...)
        return {"success": True, "questions": questions}
    except AIServiceError as e:
        return {
            "success": False,
            **service.get_error_response()
        }
```

### Step 5: Database Migrations

Add fields to `User` model in `backend-python/app/models/user.py`:

```python
from sqlalchemy import Column, String, Boolean, DateTime
from datetime import datetime

class User(Base):
    # ... existing fields ...
    
    # Custom API key management (encrypted in production)
    custom_api_key = Column(String(500), nullable=True)
    custom_api_key_provider = Column(String(50), nullable=True)
    custom_api_key_label = Column(String(255), nullable=True)
    custom_api_key_created_at = Column(DateTime, nullable=True)
    custom_api_key_last_used = Column(DateTime, nullable=True)
    
    # Generation preferences
    preferred_provider = Column(String(50), default="backend")
    enable_local_models = Column(Boolean, default=False)
    fallback_strategy = Column(String(50), default="next_available")
```

### Step 6: Environment Configuration

Add to `.env`:

```env
# Local Model Configuration
OLLAMA_URL=http://localhost:11434
LOCAL_MODELS_ENABLED=false
ANDROID_APP_PATH=/data/data/com.questionmind/

# API Key Encryption (production)
API_KEY_ENCRYPTION_KEY=your-encryption-key-here
```

Add to `backend-python/app/config.py`:

```python
class Settings(BaseSettings):
    # ... existing settings ...
    
    OLLAMA_URL: str = "http://localhost:11434"
    LOCAL_MODELS_ENABLED: bool = False
    API_KEY_ENCRYPTION_KEY: Optional[str] = None
    
    class Config:
        env_file = ".env"
```

## 🔐 Security Considerations

### API Key Encryption

In production, encrypt custom API keys before storage:

```python
from cryptography.fernet import Fernet

def encrypt_key(api_key: str, encryption_key: str) -> str:
    cipher = Fernet(encryption_key.encode())
    return cipher.encrypt(api_key.encode()).decode()

def decrypt_key(encrypted_key: str, encryption_key: str) -> str:
    cipher = Fernet(encryption_key.encode())
    return cipher.decrypt(encrypted_key.encode()).decode()
```

### CORS & HTTPS

- Always use HTTPS for API endpoints in production
- Set appropriate CORS origins
- Never log actual API keys

### Rate Limiting

Consider adding rate limits per user:

```python
from fastapi_limiter import FastAPILimiter

@FastAPILimiter.limit("100/minute")
async def generate_questions(...):
    ...
```

## 📱 Mobile Implementation (React Native)

Port the same components to React Native:

1. Create `mobile-app/src/components/ProviderSelector.tsx` (React Native version)
2. Create `mobile-app/src/components/ApiKeyInput.tsx` (React Native version)
3. Create `mobile-app/src/pages/Settings.tsx` (React Native version)
4. Use same `settingsStore.ts` and `aiSettingsApi.ts` (these work in React Native)

### Mobile-Specific Considerations

- Use `@react-native-community/hooks` for secure storage
- Implement Keychain/Keystore for API key security
- Add fingerprint/face recognition for accessing saved keys

## 🧪 Testing

### Backend Test

```python
# test_ai_service.py
from app.services.enhanced_ai_service import EnhancedAIService

def test_custom_key_priority():
    service = EnhancedAIService(
        custom_api_key="test-key",
        user_preference="custom"
    )
    # Custom key should be first in chain
    assert service.provider_chain[0]["name"] == "custom"

def test_local_model_fallback():
    service = EnhancedAIService(enable_local_models=True)
    # Local model should be last in chain
    assert service.provider_chain[-1]["type"] == "local_model"
```

### Frontend Test

```typescript
// Settings.test.tsx
import { render, screen } from '@testing-library/react';
import { Settings } from './Settings';

describe('Settings', () => {
  it('renders provider selector', () => {
    render(<Settings />);
    expect(screen.getByText('Use Backend Keys')).toBeInTheDocument();
    expect(screen.getByText('Use Custom API Key')).toBeInTheDocument();
  });
});
```

## 🚀 Feature Checklist

- [ ] Backend router registered in main.py
- [ ] Frontend routes added to App.tsx
- [ ] Sidebar menu updated with Settings link
- [ ] User model database fields added
- [ ] Database migration created and run
- [ ] Question generation endpoints updated to use EnhancedAIService
- [ ] Environment variables configured
- [ ] API key encryption implemented
- [ ] Settings page added to mobile app
- [ ] Components styled to match existing UI
- [ ] Error handling tested with all providers
- [ ] Local model support tested on device
- [ ] Security audit completed
- [ ] Documentation updated

## 📞 Provider Documentation

### Groq
- Free tier: 30 API calls/minute, 14,000 tokens/minute
- Keys start with `gsk-`
- [Get API Key](https://console.groq.com/keys)

### Cerebras
- API key format: `sk-...`
- Free tier available
- [Get API Key](https://cloud.cerebras.ai/login)

### NVIDIA NIM
- Enterprise-focused
- [Get API Key](https://console.cloud.nvidia.com/)

### OpenRouter
- Supports multiple models
- [Get API Key](https://openrouter.ai/login)

## 🔄 Provider Chain Logic

```
User makes request
  ↓
[1] Try custom API key (if provided & preferred)
  ↓ (if fails)
[2] Try Cerebras Key 1 (backend)
  ↓ (if rate limited)
[3] Try Cerebras Key 2 (backend rotation)
  ↓ (if fails)
[4] Try Groq (backend)
  ↓ (if fails)
[5] Try NVIDIA NIM (backend)
  ↓ (if fails)
[6] Try OpenRouter (backend)
  ↓ (if fails)
[7] Try Local Model (if enabled)
  ↓ (if fails)
❌ Return error with fallback options
```

## 📊 Error Response Format

```json
{
  "success": false,
  "error": "All AI providers exhausted",
  "details": {
    "providers_tried": [
      {
        "name": "custom",
        "status": "failed",
        "error": "Invalid API key",
        "code": 401
      }
    ],
    "backend_keys_configured": 5,
    "custom_key_provided": true,
    "local_models_enabled": false
  },
  "fallback_options": [
    {
      "action": "add_api_key",
      "label": "Add Your Own API Key"
    },
    {
      "action": "enable_local_model",
      "label": "Enable Local Model"
    }
  ],
  "next_steps": [
    {
      "action": "add_api_key",
      "label": "Go to Settings",
      "url": "/settings/ai"
    }
  ]
}
```

## 🎯 Next Steps

1. Review and test enhanced_ai_service.py with real API keys
2. Test local_model_service.py with Ollama setup
3. Implement database migrations
4. Add encryption for API key storage
5. Port components to React Native for mobile
6. Add comprehensive error handling and user feedback
7. Performance test with large question batches
8. Security audit and penetration testing
