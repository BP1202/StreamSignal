import logging
from typing import Dict, Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import text
from app.core.config import get_settings
from app.core.database import check_db_health, engine

logger = logging.getLogger("streamsignal.health")
router = APIRouter()
settings = get_settings()


class HealthResponse(BaseModel):
    """Standard health check response model."""
    status: str = Field(..., examples=["healthy"])
    app_name: str = Field(..., examples=["StreamSignal Backend"])
    environment: str = Field(..., examples=["development"])
    version: str = Field(..., examples=["0.1.0"])


class DatabaseHealthResponse(BaseModel):
    """Database connectivity and extension status response model."""
    status: str = Field(..., examples=["healthy"])
    message: str = Field(..., examples=["Database reachable with PostGIS and pgvector enabled"])
    details: Dict[str, Any]


class ExtensionVerifyResponse(BaseModel):
    """Response verifying query execution of geospatial and vector extensions."""
    status: str = Field(..., examples=["verified"])
    postgis_result: str = Field(..., examples=["POINT(12.34 56.78)"])
    pgvector_distance: float = Field(..., examples=[5.196152422706632])


@router.get("", response_model=HealthResponse, summary="Basic Health Check")
@router.get("/", response_model=HealthResponse, include_in_schema=False)
def health_check() -> HealthResponse:
    """Basic health check endpoint for container orchestrators and load balancers."""
    return HealthResponse(
        status="healthy",
        app_name=settings.APP_NAME,
        environment=settings.ENVIRONMENT,
        version=settings.VERSION,
    )


@router.get("/db", summary="Database Health Check")
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
        logger.error("Database health check failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database health check failed: service unavailable or connectivity error",
        )


@router.get("/extensions/verify", response_model=ExtensionVerifyResponse, summary="Verify Spatial and Vector Execution")
def verify_extensions_execution() -> ExtensionVerifyResponse:
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

            return ExtensionVerifyResponse(
                status="verified",
                postgis_result=str(gis_res),
                pgvector_distance=float(vector_res),
            )
    except Exception as exc:
        logger.error("Extension execution error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Extension query execution failed: spatial or vector feature error",
        )
