import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

class AnalysisQueryRequest(BaseModel):
    dataset_id: str
    question: str
    context: Dict[str, Any] = Field(default_factory=dict)

class ChartDataPoint(BaseModel):
    model_config = ConfigDict(extra="allow")

class ChartSpec(BaseModel):
    chart_type: str = "bar"  # "bar", "line", "pie", "scatter", "table", "metric_card"
    title: str
    x_axis: Optional[str] = None
    y_axis: Optional[str] = None
    series: List[str] = Field(default_factory=list)
    data: List[Dict[str, Any]] = Field(default_factory=list)
    description: Optional[str] = None

class AgentPlanOutput(BaseModel):
    selected_tool: str
    parameters: Dict[str, Any] = Field(default_factory=dict)
    rationale: str
    warnings: List[str] = Field(default_factory=list)

class AgentQueryResponse(BaseModel):
    status: str = "success"  # "success", "failed", "rejected"
    tool: str
    reason: str
    result_id: str
    chart_spec: Dict[str, Any] = Field(default_factory=dict)
    insights: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    latency_ms: Optional[float] = None
    data_preview: Optional[List[Dict[str, Any]]] = None

class AnalysisHistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    result_id: str
    dataset_id: str
    question: str
    tool: str
    status: str
    reason: str
    latency_ms: float
    chart_spec: Dict[str, Any]
    insights: List[str]
    warnings: List[str]
    created_at: datetime.datetime

class AnalysisHistoryResponse(BaseModel):
    history: List[AnalysisHistoryItem]
    total: int
