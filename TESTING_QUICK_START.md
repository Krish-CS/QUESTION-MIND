# Quick Start Testing Guide

## Phase 1: Backend Setup & Testing (Do This First)

### Step 1.1: Register the AI Settings Router

Edit `backend-python/app/main.py`:

```python
# Add this import at the top
from app.routers import ai_settings

# Inside your FastAPI app creation, add:
app.include_router(ai_settings.router)
```

Then test if it loaded:
```bash
cd backend-python
python -c "from app.routers import ai_settings; print('✓ Router imported successfully')"
```

### Step 1.2: Test Backend Endpoints

Start the backend:
```bash
cd backend-python
uvicorn app.main:app --reload --port 8000
```

In another terminal, test endpoints:
```bash
# Test 1: Get device capabilities
curl -X GET http://localhost:8000/api/ai-settings/device-capabilities \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test 2: Get provider status
curl -X GET http://localhost:8000/api/ai-settings/status \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test 3: Test an API key (Groq example)
curl -X POST http://localhost:8000/api/ai-settings/test-key \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"provider":"groq","api_key":"gsk-YOUR_GROQ_KEY_HERE"}'

# Test 4: Save an API key
curl -X POST http://localhost:8000/api/ai-settings/api-key \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"provider":"groq","api_key":"gsk-YOUR_KEY","label":"My Groq Key"}'
```

### Step 1.3: Test Question Generation with Custom Key

Create a test script:

```python
# backend-python/test_enhanced_service.py
import asyncio
from app.services.enhanced_ai_service import EnhancedAIService

async def test_service():
    # Test 1: Backend keys only
    print("Test 1: Backend keys provider chain")
    service = EnhancedAIService(user_id="user123", user_preference="backend")
    print(f"  ✓ Chain length: {len(service.provider_chain)}")
    print(f"  ✓ First provider: {service.provider_chain[0]['name']}")
    
    # Test 2: Custom key
    print("\nTest 2: Custom key priority")
    service = EnhancedAIService(
        user_id="user123",
        custom_api_key="gsk-test-key",
        user_preference="custom"
    )
    print(f"  ✓ Custom key is first: {service.provider_chain[0]['name'] == 'custom'}")
    
    # Test 3: Error response
    print("\nTest 3: Error response format")
    service = EnhancedAIService(enable_local_models=True)
    error_resp = service.get_error_response()
    print(f"  ✓ Has fallback options: {'fallback_options' in error_resp}")
    print(f"  ✓ Fallback count: {len(error_resp.get('fallback_options', []))}")
    
    print("\n✅ All backend tests passed!")

asyncio.run(test_service())
```

Run it:
```bash
cd backend-python
python test_enhanced_service.py
```

---

## Phase 2: Frontend Setup & Testing

### Step 2.1: Install Dependencies

```bash
cd frontend
npm install
```

The store and API should already work since they're just TypeScript/React.

### Step 2.2: Start Frontend Dev Server

```bash
cd frontend
npm run dev
```

This starts at `http://localhost:5173` (or shown in terminal)

### Step 2.3: Test Settings Page in Browser

1. **Login** with your test user account
2. **Navigate** to `http://localhost:5173/settings`
3. **Check** each section:

#### Test 3.1: Provider Selector
- [ ] Can click "Backend Keys" radio button
- [ ] Can click "Custom API Key" radio button
- [ ] Can click "Local Model" radio button (if device supports)
- [ ] Shows device capabilities info

#### Test 3.2: API Key Input
- [ ] Can select provider (Groq, Cerebras, OpenRouter)
- [ ] Can paste API key
- [ ] Password reveal toggle works
- [ ] Can add label
- [ ] **Click "Test Key"** → Should show ✓ or ✗
- [ ] **Click "Save Key"** → Should save and show masked key
- [ ] Saved key shows with label and last 6 chars

#### Test 3.3: Provider Status
- [ ] Shows list of available providers
- [ ] Shows their status (available/unavailable)
- [ ] **Click refresh button** → Updates status

#### Test 3.4: Advanced Tab
- [ ] Shows device capabilities
- [ ] Shows available local models
- [ ] Can toggle "Enable Local Models" (if supported)

### Step 2.4: Test with Browser DevTools

Open DevTools (F12) and check:

```javascript
// In Console tab, test the store:
// 1. Check store values
localStorage.getItem('ai-settings-storage')

// 2. Import and test API
import { aiSettingsApi } from './src/lib/aiSettingsApi.js'
await aiSettingsApi.getProviderStatus()

// 3. Check settings store
import { useAISettingsStore } from './src/lib/settingsStore.js'
const store = useAISettingsStore.getState()
console.log(store.preferredProvider)
console.log(store.customKeySettings)
```

---

## Phase 3: End-to-End Integration Testing

### Step 3.1: Update Question Generation Endpoint

Edit `backend-python/app/routers/question_bank.py`:

```python
# At the top, add:
from app.services.enhanced_ai_service import EnhancedAIService, AIServiceError

# Find the generate_questions endpoint and update it:
@router.post("/generate")
async def generate_questions(
    request: GenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # Get user preferences
        custom_key = getattr(current_user, 'custom_api_key', None)
        user_pref = getattr(current_user, 'preferred_provider', 'backend')
        enable_local = getattr(current_user, 'enable_local_models', False)
        
        # Create enhanced service
        service = EnhancedAIService(
            user_id=str(current_user.id),
            custom_api_key=custom_key,
            user_preference=user_pref,
            enable_local_models=enable_local
        )
        
        # Generate questions
        questions = await service.generate_questions(
            subject_id=request.subject_id,
            units=request.units,
            part_configs=request.part_configs
        )
        
        return {
            "success": True,
            "questions": questions,
            "provider_used": service.provider_chain[0]["name"]
        }
        
    except AIServiceError as e:
        # Return error with fallback options
        error_response = service.get_error_response()
        return {
            "success": False,
            **error_response
        }
```

### Step 3.2: Test End-to-End Flow

```bash
# 1. Set a custom API key via Settings page in browser
# 2. Go to Question Generation page
# 3. Try to generate questions
# Should see: "✓ Success with custom" or "Provider: custom-key" in response
```

### Step 3.3: Test Fallback Behavior

```bash
# 1. Save INVALID custom API key in Settings
# 2. Try to generate questions
# 3. Should fallback to backend keys
# 4. Should show error response with fallback options
```

### Step 3.4: Test Error Handling

```bash
# Turn off all API keys (set them to empty in config)
# Try to generate questions
# Should get error response with:
# - "All AI providers exhausted"
# - List of providers tried
# - Fallback options (add custom key, enable local model)
```

---

## Phase 4: Quick Tests via cURL

Test the full flow:

```bash
# 1. Get auth token (login first)
export TOKEN="your_jwt_token_from_login"
export API="http://localhost:8000"

# 2. Check device capabilities
curl -X GET $API/api/ai-settings/device-capabilities \
  -H "Authorization: Bearer $TOKEN"

# 3. Check current settings
curl -X GET $API/api/ai-settings/preferences \
  -H "Authorization: Bearer $TOKEN"

# 4. Save API key
curl -X POST $API/api/ai-settings/api-key \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "groq",
    "api_key": "gsk-YOUR_REAL_KEY",
    "label": "Test Key"
  }'

# 5. Test the key
curl -X POST $API/api/ai-settings/test-key \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "groq",
    "api_key": "gsk-YOUR_REAL_KEY"
  }'

# 6. Save preference
curl -X POST $API/api/ai-settings/preferences \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "preferred_provider": "custom",
    "use_local_models": false,
    "fallback_strategy": "next_available"
  }'

# 7. Generate questions with new settings
curl -X POST $API/api/question-bank/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subject_id": "python-basics",
    "units": [{"name": "Variables", "topics": ["assignment", "types"]}],
    "part_configs": [{"name": "Part A", "count": 5, "btlLevels": ["BTL1", "BTL2"]}]
  }'
```

---

## Phase 5: Mobile Testing (Optional for now)

Skip for initial testing. Come back after web is working.

---

## Troubleshooting

### Issue: "403 Unauthorized" on API calls
**Fix:** Make sure you're using a valid JWT token. Get it from login endpoint first.

### Issue: "ModuleNotFoundError: No module named 'enhanced_ai_service'"
**Fix:** Make sure `backend-python/app/services/enhanced_ai_service.py` exists and `app/routers/ai_settings.py` is registered.

### Issue: Settings page shows "No providers configured"
**Fix:** Make sure backend API keys are set in `.env`

### Issue: Test key returns 404 even with valid key
**Fix:** Check if provider API is actually reachable. Some providers might be rate-limited.

### Issue: Settings not persisting after refresh
**Fix:** Check browser console for localStorage errors. Make sure `ai-settings-storage` key exists in DevTools Storage tab.

---

## Success Checklist ✅

- [ ] Backend router registers without errors
- [ ] `/api/ai-settings/device-capabilities` returns data
- [ ] `/api/ai-settings/status` returns provider list
- [ ] `/api/ai-settings/test-key` works with real key
- [ ] Frontend Settings page loads
- [ ] Provider selector radio buttons work
- [ ] Can paste and save API key
- [ ] API key is masked (showing only last 6 chars)
- [ ] Test key button shows ✓ or ✗
- [ ] Settings persist after page refresh
- [ ] Question generation uses custom key
- [ ] Fallback happens when provider fails
- [ ] Error response includes fallback options
- [ ] Dark mode works on Settings page
- [ ] All UI is responsive

Once all ✅, you're ready to deploy!
