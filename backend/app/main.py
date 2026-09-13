import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.api.router import api_router
from backend.app.core.config import settings
from backend.app.core.errors import (
    APIError,
    api_error_handler,
    unhandled_exception_handler,
)
from backend.app.db.session import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables
    init_db()
    yield

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Autonomous Business Intelligence Agent Backend - Safe SQL, AI Agent & Analytics Orchestration",
    lifespan=lifespan,
)

# CORS middleware for frontend access
# NOTE: allow_origins=["*"] + allow_credentials=True is INVALID per CORS spec.
# Browsers silently block credentialed cross-origin requests when origin is wildcard.
_ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176",
    ).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Exception handlers
app.add_exception_handler(APIError, api_error_handler)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Invalid request payload or parameters",
                "details": {"errors": exc.errors()},
            }
        },
    )

app.add_exception_handler(Exception, unhandled_exception_handler)

# Include main API router
app.include_router(api_router)

@app.get("/")
def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/api/health",
    }
