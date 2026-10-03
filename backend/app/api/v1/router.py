from fastapi import APIRouter
from app.api.v1.health import router as health_router
from app.api.v1.reports import router as reports_router
from app.api.v1.research import router as research_router
from app.api.v1.realtime import router as realtime_router
from app.api.v1.citizen_missions import router as citizen_missions_router
from app.api.v1.agent import router as agent_router
from app.api.v1.evidence_gaps import router as evidence_gaps_router
from app.api.v1.mission_needs import router as mission_needs_router

api_router = APIRouter()

# Register v1 domain routers
api_router.include_router(health_router, prefix="/health", tags=["Health"])
api_router.include_router(reports_router)
api_router.include_router(research_router)
api_router.include_router(realtime_router)
api_router.include_router(citizen_missions_router)
api_router.include_router(agent_router)
api_router.include_router(
    evidence_gaps_router,
    prefix="/research",
    tags=["Evidence Gap Intelligence"],
)
api_router.include_router(
    mission_needs_router,
    prefix="/research",
    tags=["Mission Needs"],
)
