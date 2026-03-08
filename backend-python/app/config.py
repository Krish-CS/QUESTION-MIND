from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "mysql+pymysql://root:@localhost:3306/question_mind"
    
    # JWT
    JWT_SECRET: str = "your-super-secret-jwt-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    
    # AI Services (set at least one)
    NVIDIA_API_KEY: str = ""
    CEREBRAS_API_KEY: str = ""
    CEREBRAS_API_KEY_2: str = ""
    GROQ_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""
    
    # CORS
    FRONTEND_URL: str = "http://localhost:5174"
    
    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings()

settings = get_settings()
