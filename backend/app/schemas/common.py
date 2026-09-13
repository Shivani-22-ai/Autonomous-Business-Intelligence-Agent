from typing import Any, Dict, Optional
from pydantic import BaseModel

class HealthResponse(BaseModel):
    status: str = "ok"
    version: str
    app_name: str
    database: str
    llm_configured: bool

class StandardErrorResponse(BaseModel):
    error: Dict[str, Any]
