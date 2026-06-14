from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

import sys

# Aiven and other PostgreSQL hosts provide connection URIs starting with postgres://.
# SQLAlchemy requires postgresql:// instead.
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+pg8000://", 1)
elif db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+pg8000://", 1)

connect_args = {}
# On Windows, if a default root.crt exists from another project (like PostgreSQL),
# libpq attempts to verify the certificate against it even for sslmode=require.
# Setting sslrootcert to 'NUL' overrides this and disables local certificate validation.
if sys.platform.startswith("win"):
    connect_args["sslrootcert"] = "NUL"

engine = create_engine(
    db_url,
    connect_args=connect_args,
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
