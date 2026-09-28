import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.api.v1.health import router as health_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("streamsignal")
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for application startup and shutdown events."""
    logger.info("Starting StreamSignal Backend service...")
    logger.info("Environment: %s", settings.ENVIRONMENT)
    logger.info("Connecting to Database at: %s:%s", settings.POSTGRES_HOST, settings.POSTGRES_PORT)
    yield
    logger.info("Shutting down StreamSignal Backend service...")


app = FastAPI(
    title=settings.APP_NAME,
    description="StreamSignal API with FastAPI, PostgreSQL 17, PostGIS, and pgvector support.",
    version="0.1.0",
    lifespan=lifespan,
)

# Enable standard CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount health routes at /api/v1 and root /health
app.include_router(health_router, prefix="/api/v1")
app.include_router(health_router, prefix="")


@app.get("/")
def root():
    """Root entrypoint returning API service status and docs URL."""
    return {
        "service": settings.APP_NAME,
        "status": "online",
        "docs_url": "/docs",
        "health_check": "/health",
        "db_health_check": "/health/db",
    }
