from typing import Generator, Dict, Any, List
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from app.core.config import get_settings

settings = get_settings()

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Dependency that yields a database session and ensures cleanup."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_db_health() -> Dict[str, Any]:
    """
    Check database connectivity and verify PostGIS and pgvector extensions.
    Returns status dictionary with database and extension details.
    """
    with engine.connect() as conn:
        # Check basic connectivity
        conn.execute(text("SELECT 1"))

        # Retrieve PostgreSQL version
        version_result = conn.execute(text("SELECT version();")).scalar()

        # Retrieve installed extensions
        extensions_result = conn.execute(
            text("SELECT extname, extversion FROM pg_extension ORDER BY extname;")
        ).fetchall()

        extensions: Dict[str, str] = {row[0]: row[1] for row in extensions_result}

        has_postgis = "postgis" in extensions
        has_pgvector = "vector" in extensions

        return {
            "connected": True,
            "version": version_result,
            "installed_extensions": extensions,
            "postgis_enabled": has_postgis,
            "pgvector_enabled": has_pgvector,
            "all_required_extensions_enabled": has_postgis and has_pgvector,
        }
