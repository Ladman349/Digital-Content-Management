# backend/app/database/database.py

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm import Session

from app.core.config import settings

DATABASE_URL = settings.DATABASE_URL

# Configure connection pooling and stale-connection shielding
engine_kwargs = {}
if not DATABASE_URL.startswith("sqlite"):
    engine_kwargs.update({
        "pool_pre_ping": True,                     # Test connections before checkout to prevent dropped-socket errors
        "pool_recycle": settings.DB_POOL_RECYCLE,  # Recycle connections every 5 minutes to stay ahead of cloud firewalls
        "pool_size": settings.DB_POOL_SIZE,        # Persistent pool connections per worker (default: 5)
        "max_overflow": settings.DB_MAX_OVERFLOW,  # Burst headroom per worker (default: 5)
        "pool_timeout": settings.DB_POOL_TIMEOUT,  # Maximum wait for a free connection
    })

engine = create_engine(DATABASE_URL, **engine_kwargs)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()