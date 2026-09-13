"""
Unit tests for Agent Analytical Tools and execution contracts.
"""

import pytest
import pandas as pd

from backend.app.tools.analytics_tools import (
    profile_dataset,
    calculate_kpis,
    detect_trends,
    detect_anomalies,
    summarize_grouped_metrics,
    run_safe_analysis,
)
from backend.app.schemas.analytics import AnalysisType


def test_tool_profile_dataset(sample_business_df):
    profile = profile_dataset(sample_business_df, filename="test.csv")
    assert profile.row_count == 6
    assert profile.column_count == 8
    assert profile.quality_summary.is_valid is True


def test_tool_calculate_kpis(sample_business_df):
    result = calculate_kpis(sample_business_df)
    assert len(result.metrics) >= 4
    revenue_kpi = next((m for m in result.metrics if "revenue" in m.name), None)
    assert revenue_kpi is not None
    assert revenue_kpi.value == 7000.0


def test_tool_detect_trends(sample_business_df):
    trend = detect_trends(sample_business_df, time_column="order_date", metric_column="revenue", frequency="ME")
    assert len(trend.points) == 3
    assert trend.overall_direction is not None


def test_tool_detect_anomalies(sample_business_df):
    anomaly = detect_anomalies(sample_business_df, contamination=0.1)
    assert anomaly.total_records == 6


def test_tool_summarize_grouped_metrics(sample_business_df):
    grouped = summarize_grouped_metrics(sample_business_df, dimensions=["region"], metrics=["revenue"])
    assert grouped.total_groups == 3
    assert grouped.chart_spec is not None


def test_tool_run_safe_analysis_kpi(sample_business_df):
    res = run_safe_analysis(sample_business_df, analysis_type="kpi")
    assert res.status == "success"
    assert res.tool == "calculate_kpis"
    assert len(res.insights) > 0


def test_tool_run_safe_analysis_trend(sample_business_df):
    res = run_safe_analysis(
        sample_business_df,
        analysis_type=AnalysisType.TREND,
        params={"time_column": "order_date", "metric_column": "revenue", "frequency": "ME"},
    )
    assert res.status == "success"
    assert res.chart_spec is not None
    assert res.chart_spec.chart_type.value == "line"


def test_tool_run_safe_analysis_grouped(sample_business_df):
    res = run_safe_analysis(
        sample_business_df,
        analysis_type="grouped",
        params={"dimensions": ["region"], "metrics": ["profit"], "top_n": 2},
    )
    assert res.status == "success"
    assert res.chart_spec is not None
    assert len(res.chart_spec.data) == 2


def test_tool_run_safe_analysis_invalid_type(sample_business_df):
    with pytest.raises(ValueError) as exc_info:
        run_safe_analysis(sample_business_df, analysis_type="unsupported_type")
    assert "Unsupported analysis type" in str(exc_info.value)
