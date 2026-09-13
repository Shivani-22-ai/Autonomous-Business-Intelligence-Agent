from typing import Any, Dict, Optional
from fastapi import Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Optional[Dict[str, Any]] = None

class ErrorResponse(BaseModel):
    error: ErrorDetail

class APIError(Exception):
    def __init__(
        self,
        message: str,
        code: str = "BAD_REQUEST",
        status_code: int = status.HTTP_400_BAD_REQUEST,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}

class NotFoundError(APIError):
    def __init__(self, message: str = "Resource not found", details: Optional[Dict[str, Any]] = None):
        super().__init__(message=message, code="NOT_FOUND", status_code=status.HTTP_404_NOT_FOUND, details=details)

class SecurityError(APIError):
    def __init__(self, message: str = "Security validation failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(message=message, code="SECURITY_VIOLATION", status_code=status.HTTP_403_FORBIDDEN, details=details)

class ValidationError(APIError):
    def __init__(self, message: str = "Validation failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(message=message, code="BAD_REQUEST", status_code=status.HTTP_400_BAD_REQUEST, details=details)

class LLMProviderError(APIError):
    def __init__(self, message: str = "LLM provider invocation failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(message=message, code="LLM_PROVIDER_ERROR", status_code=status.HTTP_502_BAD_GATEWAY, details=details)

class ToolExecutionError(APIError):
    def __init__(self, message: str = "Tool execution failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(message=message, code="TOOL_EXECUTION_ERROR", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, details=details)

async def api_error_handler(request: Request, exc: APIError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
            }
        },
    )

async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected server error occurred.",
                "details": {"error_type": type(exc).__name__} if getattr(request.app.state, "debug", False) else {},
            }
        },
    )
