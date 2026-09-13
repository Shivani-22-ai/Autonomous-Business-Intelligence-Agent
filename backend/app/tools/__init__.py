"""
Bounded analytical tools package for AI agent execution and developer integration.
"""

from .analytics_tools import (
    profile_dataset,
    calculate_kpis,
    detect_trends,
    detect_anomalies,
    summarize_grouped_metrics,
    run_safe_analysis,
)

__all__ = [
    "profile_dataset",
    "calculate_kpis",
    "detect_trends",
    "detect_anomalies",
    "summarize_grouped_metrics",
    "run_safe_analysis",
]
