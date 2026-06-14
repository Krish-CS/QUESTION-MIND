import logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler()]
)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from app.routers import auth, subjects, syllabus, question_bank, staff
from .config import settings

# Create tables (PostgreSQL will create them if they don't exist)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Question Mind API",
    description="AI-powered Question Bank Generator",
    version="2.0.0"
)

# ── CORS — allow website, mobile app (Capacitor), and local dev ──────────
allowed_origins = [
    settings.FRONTEND_URL,
    "https://krish-cs.github.io",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    # Capacitor mobile app origins
    "capacitor://localhost",
    "http://localhost",
    "https://localhost",
    "ionic://localhost",
]

# If deployed on Render, also allow the Render URL as an origin
if settings.RENDER_EXTERNAL_URL:
    allowed_origins.append(settings.RENDER_EXTERNAL_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth, prefix="/api")
app.include_router(subjects, prefix="/api")
app.include_router(syllabus, prefix="/api")
app.include_router(question_bank, prefix="/api")
app.include_router(staff, prefix="/api")

import os
from fastapi.staticfiles import StaticFiles
os.makedirs("data/images", exist_ok=True)
app.mount("/api/static/images", StaticFiles(directory="data/images"), name="images")

@app.get("/")
async def root():
    return {"message": "Question Mind API v2.0 - FastAPI + PostgreSQL"}

@app.get("/api/health")
async def health():
    return {"status": "ok"}
