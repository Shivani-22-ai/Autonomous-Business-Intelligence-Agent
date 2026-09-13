"""
Unit tests for KPI Engine (ANA-01 acceptance check).
Validates numerical correctness against hand-calculated ground truths.
"""

import pytest
import pandas as pd
from backend.app.analytics.kpi import KPIEngine
from backend.app.schemas.analytics import KPIMetricConfig, KPIMetricType


def test_kpi_calculations_hand_checked_truth(sample_business_df):
    """
    sample_business_df has:
    revenues = [1000, 500, 2000, 1500, 1200, 800] -> sum = 7000.0, avg = 1166.67
    profit   = [400,  200, 800,  600,  480,  320]  -> sum = 2800.0, avg = 466.67
    units    = [10,   5,   20,   15,   12,   8]    -> sum = 70
    orders   = 6 unique
    margin   = (2800 / 7000) * 100 = 40.0%
    """
    configs = [
        KPIMetricConfig(name="tot_rev", metric_type=KPIMetricType.SUM, target_column="revenue", unit="$"),
        KPIMetricConfig(name="avg_rev", metric_type=KPIMetricType.AVERAGE, target_column="revenue", unit="$"),
        KPIMetricConfig(name="tot_prof", metric_type=KPIMetricType.SUM, target_column="profit", unit="$"),
        KPIMetricConfig(name="profit_margin", metric_type=KPIMetricType.MARGIN, target_column="revenue", cost_column="profit", unit="%"),
        KPIMetricConfig(name="tot_units", metric_type=KPIMetricType.SUM, target_column="units"),
        KPIMetricConfig(name="order_cnt", metric_type=KPIMetricType.DISTINCT_COUNT, target_column="order_id"),
        KPIMetricConfig(name="min_rev", metric_type=KPIMetricType.MIN, target_column="revenue"),
        KPIMetricConfig(name="max_rev", metric_type=KPIMetricType.MAX, target_column="revenue"),
    ]

    result = KPIEngine.calculate_kpis(sample_business_df, configs)
    assert len(result.metrics) == 8
    assert len(result.warnings) == 0

    metric_map = {m.name: m for m in result.metrics}

    assert metric_map["tot_rev"].value == 7000.0
    assert metric_map["avg_rev"].value == 1166.67
    assert metric_map["tot_prof"].value == 2800.0
    assert metric_map["profit_margin"].value == 40.0
    assert metric_map["tot_units"].value == 70.0
    assert metric_map["order_cnt"].value == 6.0
    assert metric_map["min_rev"].value == 500.0
    assert metric_map["max_rev"].value == 2000.0


def test_kpi_missing_column_fails_gracefully(sample_business_df):
    invalid_config = [
        KPIMetricConfig(name="non_existent", metric_type=KPIMetricType.SUM, target_column="non_existent_col")
    ]
    result = KPIEngine.calculate_kpis(sample_business_df, invalid_config)
    # Must not invent numbers, must flag in warnings
    assert len(result.metrics) == 0
    assert len(result.warnings) == 1
    assert "not found" in result.warnings[0]


def test_auto_discover_kpis(sample_business_df):
    discovered = KPIEngine.auto_discover_kpis(sample_business_df)
    names = [c.name for c in discovered]
    assert "total_revenue" in names
    assert "total_profit" in names
    assert "profit_margin" in names
    assert "total_units" in names
    assert "order_count" in names


def test_period_over_period_kpi_calculation(sample_business_df):
    configs = [
        KPIMetricConfig(name="tot_rev", metric_type=KPIMetricType.SUM, target_column="revenue", unit="$")
    ]
    result = KPIEngine.calculate_kpis(sample_business_df, configs, time_column="order_date")
    assert len(result.metrics) == 1
    m = result.metrics[0]
    assert m.previous_value is not None
    assert m.change_value is not None
    assert m.change_percentage is not None
