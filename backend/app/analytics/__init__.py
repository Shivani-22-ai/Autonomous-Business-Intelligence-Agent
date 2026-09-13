"""
Analytics package providing data profiling, KPI engines, trend analysis, anomaly detection, and grouping.
"""

from .profiler import DatasetProfiler
from .kpi import KPIEngine
from .trends import TrendAnalyzer
from .anomalies import AnomalyDetector
from .grouped import GroupedAnalyzer

__all__ = [
    "DatasetProfiler",
    "KPIEngine",
    "TrendAnalyzer",
    "AnomalyDetector",
    "GroupedAnalyzer",
]
