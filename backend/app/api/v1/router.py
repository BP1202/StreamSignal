from fastapi import APIRouter
from app.api.v1.health import router as health_router
from app.api.v1.reports import router as reports_router

api_router = APIRouter()

# Register v1 domain routers
api_router.include_router(health_router, prefix="/health", tags=["Health"])
api_router.include_router(reports_router)
