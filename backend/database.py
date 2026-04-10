"""
Database configuration and session management for SQLAlchemy.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from models import Base

def _default_sqlite_url() -> str:
    """
    Demo-friendly default DB.

    We default to a SQLite file in the backend folder so:
    - local runs work out-of-the-box
    - Render / simple VM deploys can run without provisioning Postgres
    """
    here = os.path.dirname(os.path.abspath(__file__))
    return f"sqlite:///{os.path.join(here, 'rud_demo.db')}"


DATABASE_URL = (os.getenv("DATABASE_URL") or "").strip() or _default_sqlite_url()

_is_sqlite = DATABASE_URL.startswith("sqlite:")
engine_kwargs = {
    "echo": False,
    "pool_pre_ping": True,  # Test connections before using them
}
if _is_sqlite:
    # Required for SQLite when used in web apps / threads.
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **engine_kwargs)

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
