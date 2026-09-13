"""
Unit tests for automatic schema and data quality profiler (DATA-03 acceptance check).
"""

import pandas as pd
import numpy as np
import pytest

from backend.app.analytics.profiler import DatasetProfiler
from backend.app.schemas.dataset import ColumnType


def test_profile_synthetic_business_data(synthetic_csv_path):
    df = pd.read_csv(synthetic_csv_path)
    profile = DatasetProfiler.profile_dataframe(df, dataset_id="test-id", filename="synthetic_business_data.csv")

    assert profile.row_count == 250
    assert profile.column_count == 9
    assert len(profile.columns) == 9

    col_map = {c.name: c for c in profile.columns}

    # Verify type inference
    assert col_map["order_id"].inferred_type in {ColumnType.TEXT, ColumnType.CATEGORICAL}
    assert col_map["order_date"].inferred_type == ColumnType.DATETIME
    assert col_map["region"].inferred_type == ColumnType.CATEGORICAL
    assert col_map["product"].inferred_type == ColumnType.CATEGORICAL
    assert col_map["customer_segment"].inferred_type == ColumnType.CATEGORICAL
    assert col_map["units"].inferred_type == ColumnType.NUMERIC
    assert col_map["revenue"].inferred_type == ColumnType.NUMERIC
    assert col_map["cost"].inferred_type == ColumnType.NUMERIC
    assert col_map["profit"].inferred_type == ColumnType.NUMERIC

    # Verify stats presence for numeric columns
    rev_stats = col_map["revenue"].stats
    assert "mean" in rev_stats
    assert "median" in rev_stats
    assert "min" in rev_stats
    assert "max" in rev_stats
    assert rev_stats["min"] > 0

    # Verify datetime stats
    dt_stats = col_map["order_date"].stats
    assert "min_date" in dt_stats
    assert "max_date" in dt_stats
    assert dt_stats["span_days"] > 300

    # Verify quality summary
    assert profile.quality_summary.is_valid is True
    assert profile.quality_summary.duplicate_row_count == 0


def test_profiler_data_quality_alerts():
    # DataFrame with constant column, high missingness column, and duplicate rows
    df = pd.DataFrame({
        "id": [1, 2, 3, 4, 4],
        "constant_col": ["Fixed", "Fixed", "Fixed", "Fixed", "Fixed"],
        "mostly_null": [None, None, 10.0, None, None],
        "category": ["A", "B", "A", "B", "B"],
    })

    profile = DatasetProfiler.profile_dataframe(df, dataset_id="alert-id")
    quality = profile.quality_summary

    assert "constant_col" in quality.constant_columns
    assert "mostly_null" in quality.high_missingness_columns
    assert quality.duplicate_row_count == 1
    assert len(quality.issues) >= 3


def test_profiler_json_serializability(sample_business_df):
    profile = DatasetProfiler.profile_dataframe(sample_business_df, dataset_id="json-id")
    # Must serialize to dictionary without errors
    dumped = profile.model_dump()
    assert dumped["dataset_id"] == "json-id"
    assert len(dumped["preview"]) == 5
