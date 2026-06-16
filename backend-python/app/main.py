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

# Create tables (PostgreSQL will create them if they don't exist)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Question Mind API",
    description="AI-powered Question Bank Generator",
    version="2.0.0"
)

# ── CORS — allow all origins (website + Capacitor mobile app + local dev) ──
# Credentials are disabled, so a wildcard origin is safe here.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
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
