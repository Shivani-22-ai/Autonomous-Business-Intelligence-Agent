"""
Analytics schemas for KPIs, trend analysis, anomaly detection, grouped aggregations, and chart specs.
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field


class KPIMetricType(str, Enum):
    SUM = "sum"
    AVERAGE = "average"
    COUNT = "count"
    DISTINCT_COUNT = "distinct_count"
    MIN = "min"
    MAX = "max"
    MARGIN = "margin"
    GROWTH = "growth"


class KPIMetricConfig(BaseModel):
    name: str
    metric_type: KPIMetricType
    target_column: str
    cost_column: Optional[str] = None  # for margin calculation: (target - cost) / target * 100
    display_name: Optional[str] = None
    unit: Optional[str] = None
    precision: int = 2


class KPIMetricResult(BaseModel):
    name: str
    display_name: str
    metric_type: KPIMetricType
    target_column: str
    value: float
    formatted_value: str
    unit: Optional[str] = None
    previous_value: Optional[float] = None
    change_value: Optional[float] = None
    change_percentage: Optional[float] = None
    description: Optional[str] = None


class KPIEngineResult(BaseModel):
    metrics: List[KPIMetricResult]
    period_label: Optional[str] = None
    computed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    warnings: List[str] = Field(default_factory=list)


class TrendDirection(str, Enum):
    UPWARD = "upward"
    DOWNWARD = "downward"
    FLAT = "flat"
    VOLATILE = "volatile"


class TrendPoint(BaseModel):
    period: str
    metric_value: float
    change: Optional[float] = None
    change_percentage: Optional[float] = None
    moving_average: Optional[float] = None


class TrendResult(BaseModel):
    metric_column: str
    time_column: str
    frequency: str  # e.g., 'M', 'W', 'D', 'Q', 'Y'
    overall_direction: TrendDirection
    total_growth_percentage: float
    start_value: float
    end_value: float
    points: List[TrendPoint]
    peak_period: Optional[str] = None
    peak_value: Optional[float] = None
    trough_period: Optional[str] = None
    trough_value: Optional[float] = None
    insights: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


class AnomalyPoint(BaseModel):
    row_index: int
    record_id: Optional[str] = None
    anomaly_score: float  # Lower / more negative = more anomalous
    is_anomaly: bool = True
    outlier_features: List[Dict[str, Any]] = Field(default_factory=list)
    record_data: Dict[str, Any]
    explanation: str


class AnomalyResult(BaseModel):
    total_records: int
    anomaly_count: int
    contamination_rate: float
    method: str  # 'IsolationForest' | 'IQR'
    features_analyzed: List[str]
    anomalies: List[AnomalyPoint]
    insights: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


class ChartType(str, Enum):
    BAR = "bar"
    LINE = "line"
    AREA = "area"
    PIE = "pie"
    SCATTER = "scatter"


class ChartSpec(BaseModel):
    chart_type: ChartType
    title: str
    x_key: str
    y_keys: List[str]
    data: List[Dict[str, Any]]
    x_label: Optional[str] = None
    y_label: Optional[str] = None
    colors: Optional[List[str]] = None


class GroupedMetricResult(BaseModel):
    dimensions: List[str]
    metrics: List[str]
    data: List[Dict[str, Any]]
    total_groups: int
    chart_spec: Optional[ChartSpec] = None
    warnings: List[str] = Field(default_factory=list)


class AnalysisType(str, Enum):
    KPI = "kpi"
    TREND = "trend"
    ANOMALY = "anomaly"
    GROUPED = "grouped"
    PROFILE = "profile"


class AnalysisResult(BaseModel):
    status: str = "success"
    tool: str
    reason: str
    result_id: str
    chart_spec: Optional[ChartSpec] = None
    insights: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    data: Optional[Dict[str, Any]] = None
