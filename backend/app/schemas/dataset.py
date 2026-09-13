"""
Dataset schemas conforming to technical contracts for ingestion, profiling, and metadata.
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field


class ColumnType(str, Enum):
    NUMERIC = "numeric"
    CATEGORICAL = "categorical"
    DATETIME = "datetime"
    BOOLEAN = "boolean"
    TEXT = "text"
    UNKNOWN = "unknown"


class ColumnProfile(BaseModel):
    name: str
    inferred_type: ColumnType
    nullable: bool = False
    null_count: int = 0
    null_percentage: float = 0.0
    unique_count: int = 0
    sample_values: List[Any] = Field(default_factory=list)
    stats: Dict[str, Any] = Field(default_factory=dict)


class DataQualityIssue(BaseModel):
    severity: str = Field(description="warning | error | info")
    column: Optional[str] = None
    issue_type: str
    message: str


class DataQualitySummary(BaseModel):
    is_valid: bool = True
    total_missing_cells: int = 0
    missing_percentage: float = 0.0
    duplicate_row_count: int = 0
    constant_columns: List[str] = Field(default_factory=list)
    high_missingness_columns: List[str] = Field(default_factory=list)
    issues: List[DataQualityIssue] = Field(default_factory=list)


class DatasetMetadata(BaseModel):
    dataset_id: str
    filename: str
    file_type: str
    row_count: int
    column_count: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DatasetProfile(BaseModel):
    dataset_id: str
    filename: str
    file_type: str
    row_count: int
    column_count: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    columns: List[ColumnProfile]
    quality_summary: DataQualitySummary
    preview: List[Dict[str, Any]] = Field(default_factory=list)
