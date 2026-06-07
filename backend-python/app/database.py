from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

# CockroachDB uses the PostgreSQL wire protocol.
# The sqlalchemy-cockroachdb dialect handles CockroachDB-specific SQL quirks.
# SSL is required for CockroachDB Cloud; the connection string includes sslmode.
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,          # auto-reconnect stale connections
    pool_size=5,                 # keep 5 connections warm
    max_overflow=10,             # allow up to 15 total under load
    pool_recycle=1800,           # recycle connections every 30 min
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
