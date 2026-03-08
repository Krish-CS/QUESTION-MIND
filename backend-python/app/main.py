from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import auth, subjects, syllabus, question_bank, staff
from .config import settings

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Question Mind API",
    description="AI-powered Question Bank Generator",
    version="2.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
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

@app.get("/")
async def root():
    return {"message": "Question Mind API v2.0 - FastAPI"}

@app.get("/api/health")
async def health():
    return {"status": "ok"}
