from fastapi import APIRouter
from backend.app.api.routes import health, datasets, analysis, reports

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(datasets.router)
api_router.include_router(analysis.router)
api_router.include_router(reports.router)
