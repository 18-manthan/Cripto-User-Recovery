"""
Database configuration and session management for SQLAlchemy.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from models import Base

# Postgres-only: require DATABASE_URL to be set explicitly.
DATABASE_URL = (os.getenv("DATABASE_URL") or "").strip()
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Configure Postgres, e.g. "
        "postgresql+psycopg2://USER:PASSWORD@HOST:5432/DBNAME"
    )
if not (DATABASE_URL.startswith("postgresql://") or DATABASE_URL.startswith("postgresql+psycopg2://")):
    raise RuntimeError(
        "This deployment is Postgres-only. DATABASE_URL must start with "
        "'postgresql://' or 'postgresql+psycopg2://'."
    )

engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,  # Test connections before using them
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """Dependency for FastAPI to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database - create all tables."""
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created successfully")


def get_session() -> Session:
    """Get a new database session."""
    return SessionLocal()
