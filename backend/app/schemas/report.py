import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

class ReportSection(BaseModel):
    title: str
    content: str
    chart_spec: Optional[Dict[str, Any]] = None
    kpis: Optional[Dict[str, Any]] = None

class ReportGenerateRequest(BaseModel):
    dataset_id: str
    title: Optional[str] = None
    focus_areas: List[str] = Field(default_factory=list)

class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    report_id: str
    dataset_id: str
    title: str
    summary: str
    sections: List[ReportSection]
    created_at: datetime.datetime
