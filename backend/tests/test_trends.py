"""
Unit tests for Trend Detection Engine (ANA-02 acceptance check).
"""

import pytest
import pandas as pd
from backend.app.analytics.trends import TrendAnalyzer
from backend.app.schemas.analytics import TrendDirection


def test_trend_analysis_sample_df(sample_business_df):
    """
    sample_business_df dates:
    2023-01: 1000 + 500 = 1500
    2023-02: 2000 + 1500 = 3500
    2023-03: 1200 + 800 = 2000
    """
    res = TrendAnalyzer.analyze_trend(
        df=sample_business_df,
        time_column="order_date",
        metric_column="revenue",
        frequency="ME",
        aggregation="sum",
    )

    assert res.metric_column == "revenue"
    assert res.time_column == "order_date"
    assert len(res.points) == 3

    # Check monthly points
    assert res.points[0].period == "2023-01"
    assert res.points[0].metric_value == 1500.0
    assert res.points[1].period == "2023-02"
    assert res.points[1].metric_value == 3500.0
    assert res.points[2].period == "2023-03"
    assert res.points[2].metric_value == 2000.0

    # Peak is 2023-02
    assert res.peak_period == "2023-02"
    assert res.peak_value == 3500.0

    # Trough is 2023-01
    assert res.trough_period == "2023-01"
    assert res.trough_value == 1500.0

    # Total growth: (2000 - 1500) / 1500 * 100 = +33.33%
    assert res.total_growth_percentage == 33.33
    assert res.overall_direction == TrendDirection.UPWARD
    assert len(res.insights) >= 2


def test_trend_analysis_synthetic_data(synthetic_csv_path):
    df = pd.read_csv(synthetic_csv_path)
    res = TrendAnalyzer.analyze_trend(
        df=df,
        time_column="order_date",
        metric_column="revenue",
    )
    assert len(res.points) > 0
    assert res.start_value > 0
    assert res.end_value > 0
    assert res.peak_value is not None


def test_trend_invalid_columns_fail_gracefully(sample_business_df):
    with pytest.raises(ValueError) as exc_info:
        TrendAnalyzer.analyze_trend(
            df=sample_business_df,
            time_column="non_existent_time",
            metric_column="revenue",
        )
    assert "Time column 'non_existent_time' not found" in str(exc_info.value)
