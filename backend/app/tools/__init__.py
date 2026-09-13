"""
Analytical tools package for AI agent execution, safe SQL, and analytical tools.
"""

from backend.app.tools.sql_tool import SafeSQLExecutor, SQLSecurityValidator
from backend.app.tools.analytics_tools import (
    profile_dataset,
    calculate_kpis,
    detect_trends,
    detect_anomalies,
    summarize_grouped_metrics,
    run_safe_analysis,
)

__all__ = [
    "SafeSQLExecutor",
    "SQLSecurityValidator",
    "profile_dataset",
    "calculate_kpis",
    "detect_trends",
    "detect_anomalies",
    "summarize_grouped_metrics",
    "run_safe_analysis",
]
