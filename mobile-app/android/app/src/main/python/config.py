from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # ── Database (Aiven PostgreSQL) ─────────────────────────
    # Connection string from Aiven console.
    # Format: postgresql://<user>:<password>@<host>:<port>/<database>?sslmode=require
    DATABASE_URL: str = "postgresql://root@localhost:5432/question_mind?sslmode=disable"

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

    # CORS — allowed frontend origins
    FRONTEND_URL: str = "http://localhost:5174"
    # Render deployment URL (set after deploying)
    RENDER_EXTERNAL_URL: str = ""

    # ── Email / SMTP ──────────────────────────────────────────────────────
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASS: str = ""
    FROM_EMAIL: str = ""
    FROM_NAME: str = "Question Mind"

    # ── Google Drive (for question bank Excel sharing) ────────────────────
    GOOGLE_DRIVE_FOLDER_ID: str = ""
    GOOGLE_SERVICE_ACCOUNT_JSON: str = ""
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REFRESH_TOKEN: str = ""

    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings()

settings = get_settings()
