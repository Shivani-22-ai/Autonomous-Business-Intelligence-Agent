"""
Unit tests for Anomaly Detection Engine (ANA-03 acceptance check).
Validates Isolation Forest performance on known seeded synthetic business anomalies.
"""

import pytest
import pandas as pd
from backend.app.analytics.anomalies import AnomalyDetector


def test_detect_known_seeded_anomalies(synthetic_csv_path):
    df = pd.read_csv(synthetic_csv_path)

    # In synthetic_business_data.csv, we injected anomalies at rows: 45, 112, 180, 220
    # 45: Extreme Volume/Revenue (units=350, revenue=420k)
    # 112: Severe Negative Profit Margin (revenue=3k, cost=48k, profit=-45k)
    # 180: High units with zero revenue (units=80, revenue=10, cost=8.5k)
    # 220: Extreme Cost with Normal Revenue (cost=95k, profit=-85.4k)

    res = AnomalyDetector.detect_anomalies(
        df=df,
        feature_columns=["units", "revenue", "cost", "profit"],
        contamination=0.04,  # Flag ~10 out of 250 records
    )

    assert res.anomaly_count > 0
    assert res.total_records == 250
    assert "IsolationForest" in res.method

    flagged_indices = {a.row_index for a in res.anomalies}

    # Verify that the known seeded outlier rows were detected
    assert 45 in flagged_indices, "Row 45 (extreme revenue anomaly) should be flagged"
    assert 112 in flagged_indices, "Row 112 (massive negative profit anomaly) should be flagged"
    assert 180 in flagged_indices or 220 in flagged_indices, "Row 180 or 220 should be flagged"

    # Verify explainability structure on Row 45
    row_45_anomaly = next(a for a in res.anomalies if a.row_index == 45)
    assert row_45_anomaly.anomaly_score < 0  # Isolation Forest negative score indicates anomaly
    assert len(row_45_anomaly.outlier_features) > 0
    # Check that revenue or units is flagged as significantly higher than normal
    outlier_names = [f["feature"] for f in row_45_anomaly.outlier_features]
    assert "revenue" in outlier_names or "units" in outlier_names


def test_small_dataset_anomaly_handling():
    tiny_df = pd.DataFrame({"val": [1, 2, 3]})
    res = AnomalyDetector.detect_anomalies(tiny_df)
    assert res.anomaly_count == 0
    assert len(res.warnings) > 0


def test_no_numeric_features_anomaly_handling():
    text_df = pd.DataFrame({
        "name": ["A", "B", "C", "D", "E", "F"],
        "region": ["North", "South", "East", "West", "North", "South"]
    })
    res = AnomalyDetector.detect_anomalies(text_df)
    assert res.anomaly_count == 0
    assert "Zero numeric features" in res.warnings[0]
