"""
AI Settings Router - Handle user API keys, provider status, device capabilities
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from .auth import get_current_user
from .local_model_service import LocalModelService

router = APIRouter(prefix="/api/ai-settings", tags=["ai-settings"])

# ==================== Schemas ====================

class APIKeyInput(BaseModel):
    """User-provided API key"""
    provider: str  # "custom", "groq", "cerebras", etc.
    api_key: str
    label: Optional[str] = None  # e.g., "My Groq Key"

class APIKeyResponse(BaseModel):
    """API key response (masked)"""
    provider: str
    label: Optional[str]
    masked_key: str  # e.g., "sk-...abc123" (last 6 chars visible)
    created_at: datetime
    last_used: Optional[datetime]

class ProviderStatus(BaseModel):
    """Provider availability status"""
    name: str
    status: str  # "available", "limited", "unavailable", "error"
    configured: bool
    can_use_custom: bool
    error: Optional[str]

class DeviceCapabilities(BaseModel):
    """Device capabilities for local models"""
    platform: str
    supports_local_models: bool
    available_memory_mb: int
    available_storage_mb: int
    available_models: List[Dict[str, Any]]

class GenerationPreferences(BaseModel):
    """User's preferences for question generation"""
    preferred_provider: str  # "backend" | "custom" | "local"
    use_local_models: bool
    fallback_strategy: str  # "next_available" | "manual_select"

# ==================== Endpoints ====================

@router.post("/api-key", response_model=APIKeyResponse)
async def set_custom_api_key(
    key_data: APIKeyInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Save user's custom API key
    
    The key is encrypted before storage.
    Do NOT log or display the actual key.
    """
    
    # TODO: Implement in actual User model
    # For now, this is a placeholder showing the structure
    
    try:
        # Encrypt and store API key
        # encrypted_key = encrypt(key_data.api_key)
        # current_user.custom_api_key = encrypted_key
        # current_user.custom_api_key_provider = key_data.provider
        # current_user.custom_api_key_label = key_data.label
        # current_user.custom_api_key_created_at = datetime.utcnow()
        # db.commit()
        
        # Return masked response
        return APIKeyResponse(
            provider=key_data.provider,
            label=key_data.label,
            masked_key=f"{key_data.api_key[:10]}...{key_data.api_key[-6:]}",
            created_at=datetime.utcnow(),
            last_used=None
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to save API key: {str(e)}"
        )

@router.delete("/api-key")
async def delete_custom_api_key(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove user's custom API key"""
    
    try:
        # current_user.custom_api_key = None
        # current_user.custom_api_key_provider = None
        # db.commit()
        
        return {"success": True, "message": "API key removed"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to remove API key: {str(e)}"
        )

@router.get("/api-key", response_model=Optional[APIKeyResponse])
async def get_custom_api_key(
    current_user: User = Depends(get_current_user)
):
    """Get user's custom API key info (masked)"""
    
    # if current_user.custom_api_key:
    #     return APIKeyResponse(
    #         provider=current_user.custom_api_key_provider,
    #         label=current_user.custom_api_key_label,
    #         masked_key=...,
    #         created_at=current_user.custom_api_key_created_at,
    #         last_used=current_user.custom_api_key_last_used
    #     )
    
    return None

@router.post("/test-key")
async def test_api_key(
    key_data: APIKeyInput,
    current_user: User = Depends(get_current_user)
):
    """
    Test if an API key is valid
    
    Makes a minimal API call to verify the key works.
    """
    
    try:
        # TODO: Implement test for each provider type
        # For now, placeholder logic
        
        if key_data.provider == "groq":
            return await test_groq_key(key_data.api_key)
        elif key_data.provider == "cerebras":
            return await test_cerebras_key(key_data.api_key)
        elif key_data.provider == "openrouter":
            return await test_openrouter_key(key_data.api_key)
        else:
            raise ValueError(f"Unknown provider: {key_data.provider}")
            
    except Exception as e:
        return {
            "success": False,
            "provider": key_data.provider,
            "error": str(e),
            "message": "API key test failed"
        }

async def test_groq_key(api_key: str) -> Dict[str, Any]:
    """Test Groq API key"""
    import httpx
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://api.groq.com/openai/v1/models",
                headers={"Authorization": f"Bearer {api_key}"}
            )
            
            if response.status_code == 200:
                return {
                    "success": True,
                    "provider": "groq",
                    "message": "Key is valid"
                }
            else:
                return {
                    "success": False,
                    "provider": "groq",
                    "error": f"HTTP {response.status_code}",
                    "message": "Invalid API key"
                }
    except Exception as e:
        return {
            "success": False,
            "provider": "groq",
            "error": str(e),
            "message": "Connection failed"
        }

async def test_cerebras_key(api_key: str) -> Dict[str, Any]:
    """Test Cerebras API key"""
    import httpx
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://api.cerebras.ai/v1/models",
                headers={"Authorization": f"Bearer {api_key}"}
            )
            
            if response.status_code == 200:
                return {
                    "success": True,
                    "provider": "cerebras",
                    "message": "Key is valid"
                }
            else:
                return {
                    "success": False,
                    "provider": "cerebras",
                    "error": f"HTTP {response.status_code}",
                    "message": "Invalid API key"
                }
    except Exception as e:
        return {
            "success": False,
            "provider": "cerebras",
            "error": str(e),
            "message": "Connection failed"
        }

async def test_openrouter_key(api_key: str) -> Dict[str, Any]:
    """Test OpenRouter API key"""
    import httpx
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://openrouter.ai/api/v1/models",
                headers={"Authorization": f"Bearer {api_key}"}
            )
            
            if response.status_code == 200:
                return {
                    "success": True,
                    "provider": "openrouter",
                    "message": "Key is valid"
                }
            else:
                return {
                    "success": False,
                    "provider": "openrouter",
                    "error": f"HTTP {response.status_code}",
                    "message": "Invalid API key"
                }
    except Exception as e:
        return {
            "success": False,
            "provider": "openrouter",
            "error": str(e),
            "message": "Connection failed"
        }

@router.get("/status")
async def get_provider_status(
    current_user: User = Depends(get_current_user)
) -> List[ProviderStatus]:
    """
    Get status of all available AI providers
    
    Shows which providers are configured and available.
    """
    
    from ..config import settings
    
    status_list = []
    
    # Check each backend provider
    providers = [
        {"name": "Groq", "key": settings.GROQ_API_KEY},
        {"name": "Cerebras", "key": settings.CEREBRAS_API_KEY},
        {"name": "NVIDIA NIM", "key": settings.NVIDIA_API_KEY},
        {"name": "OpenRouter", "key": settings.OPENROUTER_API_KEY},
    ]
    
    for provider in providers:
        status_list.append(ProviderStatus(
            name=provider["name"],
            status="available" if provider["key"] else "unavailable",
            configured=bool(provider["key"]),
            can_use_custom=True,
            error=None if provider["key"] else "No API key configured"
        ))
    
    return status_list

@router.get("/device-capabilities", response_model=DeviceCapabilities)
async def get_device_capabilities(
    current_user: User = Depends(get_current_user)
):
    """
    Get device capabilities for local model support
    
    Checks if device can run local models (Gemma 2B, Llama 2, etc)
    """
    
    capabilities = LocalModelService.get_device_capabilities()
    
    # Get device memory/storage info
    try:
        from .local_model_service import LocalModelService
        service = LocalModelService()
        device_info = service._get_device_info_web()
        
        return DeviceCapabilities(
            platform=capabilities.get("platform", "web"),
            supports_local_models=capabilities.get("supported", False),
            available_memory_mb=device_info.get("available_memory_mb", 0),
            available_storage_mb=device_info.get("available_storage_mb", 0),
            available_models=capabilities.get("available_models", [])
        )
    except Exception as e:
        return DeviceCapabilities(
            platform="web",
            supports_local_models=False,
            available_memory_mb=0,
            available_storage_mb=0,
            available_models=[]
        )

@router.post("/preferences")
async def set_generation_preferences(
    prefs: GenerationPreferences,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Save user's generation preferences"""
    
    try:
        # TODO: Save to user.generation_preferences
        # current_user.preferred_provider = prefs.preferred_provider
        # current_user.use_local_models = prefs.use_local_models
        # current_user.fallback_strategy = prefs.fallback_strategy
        # db.commit()
        
        return {
            "success": True,
            "message": "Preferences saved"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.get("/preferences", response_model=GenerationPreferences)
async def get_generation_preferences(
    current_user: User = Depends(get_current_user)
):
    """Get user's generation preferences"""
    
    # TODO: Load from user.generation_preferences
    return GenerationPreferences(
        preferred_provider="backend",
        use_local_models=False,
        fallback_strategy="next_available"
    )

@router.post("/local-models/download")
async def download_local_model(
    model_name: str,
    current_user: User = Depends(get_current_user)
):
    """
    Download a local model (e.g., Gemma 2B) for offline use
    
    This returns a download status endpoint to poll.
    """
    
    try:
        result = await LocalModelService.download_model(model_name)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
