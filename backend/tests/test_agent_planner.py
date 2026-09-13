import pandas as pd
import pytest

from backend.app.agents.planner import AgentPlanner
from backend.app.agents.tool_router import ToolRouter
from backend.app.agents.validator import ResultValidator
from backend.app.core.errors import ValidationError
from backend.app.schemas.dataset import ColumnDescription

@pytest.fixture
def test_df():
    data = {
        "date": ["2025-01-01", "2025-01-02", "2025-01-03", "2025-01-04"],
        "region": ["North", "South", "East", "West"],
        "revenue": [1000.0, 2000.0, 1500.0, 3000.0],
        "units": [10, 20, 15, 30],
    }
    return pd.DataFrame(data)

@pytest.fixture
def columns():
    return [
        ColumnDescription(name="date", inferred_type="datetime", nullable=False, unique_count=4),
        ColumnDescription(name="region", inferred_type="categorical", nullable=False, unique_count=4),
        ColumnDescription(name="revenue", inferred_type="numeric", nullable=False, unique_count=4),
        ColumnDescription(name="units", inferred_type="numeric", nullable=False, unique_count=4),
    ]

def test_planner_tool_selection(columns):
    planner = AgentPlanner()
    permitted = ["run_safe_sql", "calculate_kpis", "detect_trends", "detect_anomalies", "summarize_grouped_metrics"]

    # Trend question
    plan_trend = planner.create_plan("What is the revenue trend over time?", columns, permitted)
    assert plan_trend.selected_tool == "detect_trends"
    assert plan_trend.parameters.get("metric") == "revenue"

    # Grouped question
    plan_group = planner.create_plan("Breakdown revenue by region", columns, permitted)
    assert plan_group.selected_tool == "summarize_grouped_metrics"
    assert "region" in plan_group.parameters.get("dimensions", [])

    # Outlier question
    plan_anomaly = planner.create_plan("Are there any revenue outliers or anomalies?", columns, permitted)
    assert plan_anomaly.selected_tool == "detect_anomalies"

    # KPI question
    plan_kpi = planner.create_plan("What is the total and average revenue?", columns, permitted)
    assert plan_kpi.selected_tool == "calculate_kpis"

def test_tool_router_execution(test_df):
    router = ToolRouter()

    # Test KPI execution
    kpi_res = router.execute_tool("calculate_kpis", test_df, {"metrics": ["revenue"]})
    assert kpi_res["status"] == "success"
    assert "revenue" in kpi_res["payload"]["kpis"]
    assert kpi_res["payload"]["kpis"]["revenue"]["sum"] == 7500.0

    # Test Trends execution
    trend_res = router.execute_tool("detect_trends", test_df, {"time_column": "date", "metric": "revenue"})
    assert trend_res["status"] == "success"
    assert len(trend_res["payload"]["data"]) == 4

    # Test Grouped execution
    group_res = router.execute_tool("summarize_grouped_metrics", test_df, {"dimensions": ["region"], "metrics": ["revenue"]})
    assert group_res["status"] == "success"
    assert len(group_res["payload"]["data"]) == 4

    # Test Unregistered tool rejection
    with pytest.raises(ValidationError):
        router.execute_tool("unregistered_malicious_tool", test_df, {})

def test_result_validator_insights_and_charts(columns):
    # Test trend validation
    payload = {
        "metric": "revenue",
        "trend_direction": "upward",
        "growth_rate_pct": 200.0,
        "data": [{"date": "2025-01-01", "revenue": 1000.0}, {"date": "2025-01-02", "revenue": 3000.0}],
    }
    chart_spec, insights, warnings, preview = ResultValidator.validate_and_format(
        "detect_trends", "revenue trend over time", payload, columns
    )
    assert chart_spec["chart_type"] == "line"
    assert len(insights) > 0
    assert "200.0%" in insights[0] or "upward" in insights[0]
    assert len(preview) == 2
