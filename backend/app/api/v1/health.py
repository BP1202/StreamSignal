from fastapi import APIRouter, HTTPException, status
from app.core.config import get_settings
from app.core.database import check_db_health, engine
from sqlalchemy import text

router = APIRouter(prefix="", tags=["Health"])
settings = get_settings()


@router.get("/health")
def health_check():
    """Basic health check endpoint for container orchestrators and load balancers."""
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "environment": settings.ENVIRONMENT,
    }


@router.get("/health/db")
def database_health_check():
    """
    Comprehensive database health check.
    Verifies:
    1. Active connection to PostgreSQL 17
    2. PostGIS extension presence
    3. pgvector extension presence
    """
    try:
        health_info = check_db_health()
        if not health_info.get("all_required_extensions_enabled"):
            return {
                "status": "warning",
                "message": "Connected to database, but some required extensions are missing",
                "details": health_info,
            }
        return {
            "status": "healthy",
            "message": "Database reachable with PostGIS and pgvector enabled",
            "details": health_info,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database health check failed: {str(exc)}",
        )


@router.get("/health/extensions/verify")
def verify_extensions_execution():
    """
    Directly execute test queries using PostGIS and pgvector features to confirm
    full functional support.
    """
    try:
        with engine.connect() as conn:
            # Test PostGIS function (e.g., ST_Point)
            gis_res = conn.execute(text("SELECT ST_AsText(ST_Point(12.34, 56.78));")).scalar()

            # Test pgvector function (e.g., Euclidean distance between vectors)
            vector_res = conn.execute(
                text("SELECT '[1,2,3]'::vector <-> '[4,5,6]'::vector AS distance;")
            ).scalar()

            return {
                "status": "verified",
                "postgis_result": gis_res,
                "pgvector_distance": float(vector_res),
            }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Extension query execution failed: {str(exc)}",
        )
