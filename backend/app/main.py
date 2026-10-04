import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Dict, Any
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.core.auth import require_researcher_role
from app.api.v1.router import api_router as api_v1_router
from app.api.v1.health import router as health_router
from app.api.v1.realtime import router as realtime_router
from app.api.v1.research import router as research_router
from app.api.v1.evidence_gaps import router as evidence_gaps_router
from app.api.v1.mission_needs import router as mission_needs_router
from app.api.v1.citizen_missions import router as citizen_missions_router
from app.services.realtime import connection_manager
from app.core.database import Base

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("streamsignal")
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for application startup and shutdown lifecycle events."""
    logger.info("Starting %s v%s...", settings.APP_NAME, settings.VERSION)
    logger.info("Environment: %s", settings.ENVIRONMENT)
    logger.info("Connecting to Database at: %s:%s", settings.POSTGRES_HOST, settings.POSTGRES_PORT)
    connection_manager.register_loop(asyncio.get_running_loop())
    yield
    logger.info("Shutting down %s...", settings.APP_NAME)


def create_application() -> FastAPI:
    """FastAPI application factory configuring metadata, middlewares, and routers."""
    app_instance = FastAPI(
        title=settings.APP_TITLE,
        description=settings.DESCRIPTION,
        version=settings.VERSION,
        docs_url=settings.DOCS_URL,
        redoc_url=settings.REDOC_URL,
        openapi_url=settings.OPENAPI_URL,
        lifespan=lifespan,
    )

    # Configure CORS middleware using application settings
    app_instance.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register versioned API router (/api/v1)
    app_instance.include_router(api_v1_router, prefix=settings.API_V1_STR)

    # Direct top-level health routes for infrastructure and orchestrator probes (/health)
    app_instance.include_router(health_router, prefix="/health", tags=["Health"])

    # Direct top-level researcher routes with RBAC verification (/research/...)
    app_instance.include_router(research_router)
    app_instance.include_router(
        evidence_gaps_router,
        prefix="/research",
        tags=["Evidence Gaps"],
        dependencies=[Depends(require_researcher_role)],
    )
    app_instance.include_router(
        mission_needs_router,
        prefix="/research",
        tags=["Mission Needs"],
        dependencies=[Depends(require_researcher_role)],
    )

    # Direct top-level citizen routes (/citizen/...)
    app_instance.include_router(citizen_missions_router)

    # Top-level WebSocket routes (/ws/research, /ws/citizen/{report_id})
    app_instance.include_router(realtime_router)

    @app_instance.get("/", tags=["Root"], summary="Service Root")
    def root() -> Dict[str, Any]:
        """Root endpoint returning service identity, version, and API directory."""
        return {
            "service": settings.APP_NAME,
            "title": settings.APP_TITLE,
            "version": settings.VERSION,
            "environment": settings.ENVIRONMENT,
            "status": "online",
            "docs_url": settings.DOCS_URL,
            "openapi_url": settings.OPENAPI_URL,
            "api_v1_url": settings.API_V1_STR,
            "health_check": "/health",
            "api_v1_health": f"{settings.API_V1_STR}/health",
        }

    return app_instance


app = create_application()
