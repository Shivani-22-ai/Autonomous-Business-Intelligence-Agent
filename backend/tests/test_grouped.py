"""
Unit tests for Grouped Business Analysis Engine.
"""

import pytest
import pandas as pd
from backend.app.analytics.grouped import GroupedAnalyzer


def test_grouped_analysis_by_region(sample_business_df):
    """
    sample_business_df regions:
    North: revenue = 1000 + 500 = 1500, profit = 400 + 200 = 600
    South: revenue = 2000 + 1500 = 3500, profit = 800 + 600 = 1400
    East:  revenue = 1200 + 800 = 2000, profit = 480 + 320 = 800
    Total revenue = 7000.
    South share = 3500 / 7000 = 50.0%
    East share = 2000 / 7000 = 28.57%
    North share = 1500 / 7000 = 21.43%
    """
    res = GroupedAnalyzer.aggregate_grouped_metrics(
        df=sample_business_df,
        dimensions=["region"],
        metrics=["revenue", "profit"],
        aggregation="sum",
        sort_by="revenue",
        ascending=False,
    )

    assert res.total_groups == 3
    assert len(res.data) == 3

    # Top region should be South
    assert res.data[0]["region"] == "South"
    assert res.data[0]["revenue"] == 3500.0
    assert res.data[0]["profit"] == 1400.0

    # Second region should be East
    assert res.data[1]["region"] == "East"
    assert res.data[1]["revenue"] == 2000.0

    # Third region should be North
    assert res.data[2]["region"] == "North"
    assert res.data[2]["revenue"] == 1500.0

    # Verify chart spec
    assert res.chart_spec is not None
    assert res.chart_spec.x_key == "region"
    assert "revenue" in res.chart_spec.y_keys
    assert len(res.chart_spec.data) == 3


def test_grouped_analysis_top_n(sample_business_df):
    res = GroupedAnalyzer.aggregate_grouped_metrics(
        df=sample_business_df,
        dimensions=["product"],
        metrics=["revenue"],
        top_n=1,
    )
    assert len(res.data) == 1
    assert res.total_groups == 2


def test_grouped_analysis_invalid_dimension(sample_business_df):
    with pytest.raises(ValueError) as exc_info:
        GroupedAnalyzer.aggregate_grouped_metrics(
            df=sample_business_df,
            dimensions=["invalid_dimension"],
            metrics=["revenue"],
        )
    assert "None of the specified dimensions" in str(exc_info.value)
