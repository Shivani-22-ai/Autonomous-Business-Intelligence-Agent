import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

class ColumnDescription(BaseModel):
    name: str
    inferred_type: str  # numeric, categorical, datetime, text, boolean
    nullable: bool
    unique_count: int
    sample_values: List[Any] = Field(default_factory=list)

class QualitySummary(BaseModel):
    missing_cells_percentage: float = 0.0
    duplicate_rows_count: int = 0
    total_cells: int = 0
    quality_score: float = 100.0
    issues: List[str] = Field(default_factory=list)

class DatasetMetadata(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    dataset_id: str
    filename: str
    file_type: str
    row_count: int
    column_count: int
    schema_fields: List[ColumnDescription] = Field(..., alias="schema")
    quality_summary: QualitySummary
    created_at: datetime.datetime

class DatasetUploadResponse(BaseModel):
    message: str = "Dataset uploaded and profiled successfully"
    dataset: DatasetMetadata

class DatasetListResponse(BaseModel):
    datasets: List[DatasetMetadata]
    total: int
