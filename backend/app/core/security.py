import re
import uuid
from pathlib import Path
from typing import Any, Dict, Union
from backend.app.core.config import settings
from backend.app.core.errors import SecurityError, ValidationError

SAFE_FILENAME_REGEX = re.compile(r"^[a-zA-Z0-9_\-\. ]+$")
UUID4_REGEX = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$", re.I)

def validate_dataset_id(dataset_id: str) -> str:
    """Validate that the dataset_id is a valid UUIDv4."""
    if not dataset_id or not isinstance(dataset_id, str):
        raise ValidationError("Invalid dataset ID format")
    dataset_id = dataset_id.strip()
    try:
        val = uuid.UUID(dataset_id, version=4)
        return str(val)
    except ValueError:
        raise ValidationError(f"Invalid dataset_id '{dataset_id}', must be a valid UUIDv4")

def sanitize_path(base_dir: Path, filename_or_relative: Union[str, Path]) -> Path:
    """
    Ensure the resolved path stays strictly within base_dir.
    Guards against directory traversal attacks like ../../etc/passwd or ..\\..\\win.ini.
    """
    resolved_base = base_dir.resolve()
    # Normalize Windows backslashes to forward slashes for cross-platform compatibility (Linux CI vs Windows)
    raw_str = str(filename_or_relative).replace("\\", "/")
    parts = [p for p in raw_str.split("/") if p]
    if ".." in parts:
        raise SecurityError("Path traversal detected. Access denied.")

    clean_relative = raw_str.lstrip("/")
    target_path = (resolved_base / clean_relative).resolve()
    
    try:
        rel = target_path.relative_to(resolved_base)
        if str(rel) == ".":
            raise SecurityError("Path traversal detected. Access denied.")
    except ValueError:
        raise SecurityError("Path traversal detected. Access denied.")
    return target_path

def sanitize_filename(filename: str) -> str:
    """Ensure filenames contain only safe characters and no path separators."""
    # Normalize Windows backslashes so Path(...).name extracts the leaf filename on Linux as well
    normalized = str(filename).replace("\\", "/")
    clean_name = Path(normalized).name.strip()
    if not clean_name or not SAFE_FILENAME_REGEX.match(clean_name):
        # Fallback to sanitized ASCII
        clean_name = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", clean_name)
    clean_name = clean_name.replace("..", "_").replace("/", "").replace("\\", "")
    if not clean_name:
        clean_name = "unnamed_file"
    return clean_name

def mask_secrets(data: Any) -> Any:
    """Mask sensitive keys like API keys, tokens, or passwords from logs/dictionaries."""
    SENSITIVE_KEYS = {"api_key", "token", "password", "secret", "authorization", "llm_api_key"}
    if isinstance(data, dict):
        masked = {}
        for k, v in data.items():
            if any(s in str(k).lower() for s in SENSITIVE_KEYS) and isinstance(v, str):
                masked[k] = "***MASKED***" if len(v) <= 8 else v[:3] + "..." + v[-3:]
            else:
                masked[k] = mask_secrets(v)
        return masked
    elif isinstance(data, list):
        return [mask_secrets(item) for item in data]
    return data

def validate_query_text_length(text: str, max_chars: int = 4000) -> str:
    """Guard against oversized input/memory exhaustion."""
    if not text or not text.strip():
        raise ValidationError("Input query cannot be empty.")
    if len(text) > max_chars:
        raise ValidationError(f"Query text exceeds maximum allowed length of {max_chars} characters.")
    return text.strip()
