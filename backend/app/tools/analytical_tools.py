from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from backend.app.core.errors import ValidationError

def calculate_kpis(df: pd.DataFrame, metrics: Optional[List[str]] = None) -> Dict[str, Any]:
    """Compute summary KPIs across numeric columns in the dataset."""
    if df.empty:
        return {"summary": {}, "record_count": 0}

    num_cols = metrics if metrics else [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
    if not num_cols:
        raise ValidationError("No numeric columns available for KPI calculation.")

    kpi_results = {}
    for col in num_cols:
        if col not in df.columns:
            continue
        series = df[col].dropna()
        if series.empty:
            continue
        kpi_results[col] = {
            "sum": round(float(series.sum()), 2),
            "mean": round(float(series.mean()), 2),
            "median": round(float(series.median()), 2),
            "min": round(float(series.min()), 2),
            "max": round(float(series.max()), 2),
            "std": round(float(series.std()), 2) if len(series) > 1 else 0.0,
            "count": int(series.count()),
        }

    return {
        "kpis": kpi_results,
        "record_count": len(df),
    }

def detect_trends(
    df: pd.DataFrame,
    time_column: Optional[str] = None,
    metric: Optional[str] = None
) -> Dict[str, Any]:
    """Compute time-series trends and growth rates for a metric over time."""
    if df.empty:
        return {"data": [], "trend_direction": "stable", "growth_rate_pct": 0.0}

    # Identify time column if not supplied
    if not time_column:
        for c in df.columns:
            if "date" in c.lower() or "time" in c.lower() or pd.api.types.is_datetime64_any_dtype(df[c]):
                time_column = c
                break
    if not time_column or time_column not in df.columns:
        raise ValidationError("Valid time/date column is required for trend detection.")

    # Identify metric if not supplied
    if not metric:
        for c in df.columns:
            if c != time_column and pd.api.types.is_numeric_dtype(df[c]):
                metric = c
                break
    if not metric or metric not in df.columns:
        raise ValidationError("Valid numeric metric column is required for trend detection.")

    # Sort and aggregate by date
    clean_df = df[[time_column, metric]].dropna().copy()
    clean_df[time_column] = pd.to_datetime(clean_df[time_column], errors="coerce")
    clean_df = clean_df.dropna().sort_values(by=time_column)

    if clean_df.empty:
        raise ValidationError(f"No valid datetime entries in column '{time_column}'.")

    # Group by formatted date
    clean_df["date_label"] = clean_df[time_column].dt.strftime("%Y-%m-%d")
    grouped = clean_df.groupby("date_label")[metric].sum().reset_index()

    # Calculate growth rate and direction
    values = grouped[metric].values
    growth_rate = 0.0
    direction = "stable"
    if len(values) >= 2:
        start_val = values[0]
        end_val = values[-1]
        if start_val != 0:
            growth_rate = round(float((end_val - start_val) / abs(start_val) * 100.0), 2)
        if growth_rate > 2.0:
            direction = "upward"
        elif growth_rate < -2.0:
            direction = "downward"

    data_points = [
        {"date": row["date_label"], metric: round(float(row[metric]), 2)}
        for _, row in grouped.iterrows()
    ]

    return {
        "time_column": time_column,
        "metric": metric,
        "trend_direction": direction,
        "growth_rate_pct": growth_rate,
        "data": data_points,
    }

def detect_anomalies(
    df: pd.DataFrame,
    feature_columns: Optional[List[str]] = None,
    contamination: float = 0.05
) -> Dict[str, Any]:
    """Detect statistical outliers/anomalies in numeric features using Isolation Forest / z-scores."""
    if df.empty:
        return {"anomalies_count": 0, "anomalies": []}

    features = feature_columns or [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
    features = [f for f in features if f in df.columns and pd.api.types.is_numeric_dtype(df[f])]

    if not features:
        raise ValidationError("At least one numeric feature column is required for anomaly detection.")

    clean_df = df[features].dropna().copy()
    if len(clean_df) < 5:
        # Fallback to simple z-score for small fixture datasets
        anomalies = []
        for idx, row in clean_df.iterrows():
            is_anomaly = False
            for f in features:
                mean = clean_df[f].mean()
                std = clean_df[f].std()
                if std > 0 and abs(row[f] - mean) / std > 2.0:
                    is_anomaly = True
                    break
            if is_anomaly:
                item = {col: round(float(row[col]), 2) for col in features}
                item["row_index"] = int(idx)
                anomalies.append(item)
        return {
            "feature_columns": features,
            "anomalies_count": len(anomalies),
            "anomalies": anomalies,
        }

    # Isolation Forest
    clf = IsolationForest(contamination=contamination, random_state=42)
    preds = clf.fit_predict(clean_df[features])
    anomaly_indices = clean_df.index[preds == -1].tolist()

    anomalies = []
    for idx in anomaly_indices:
        row_dict = {col: round(float(clean_df.loc[idx, col]), 2) for col in features}
        row_dict["row_index"] = int(idx)
        anomalies.append(row_dict)

    return {
        "feature_columns": features,
        "anomalies_count": len(anomalies),
        "anomalies": anomalies,
    }

def summarize_grouped_metrics(
    df: pd.DataFrame,
    dimensions: List[str],
    metrics: List[str],
    aggregation: str = "sum"
) -> Dict[str, Any]:
    """Group metrics across categorical dimensions."""
    if df.empty:
        return {"data": [], "dimensions": dimensions, "metrics": metrics}

    valid_dims = [d for d in dimensions if d in df.columns]
    valid_metrics = [m for m in metrics if m in df.columns and pd.api.types.is_numeric_dtype(df[m])]

    if not valid_dims or not valid_metrics:
        raise ValidationError("At least one valid dimension and one valid numeric metric are required.")

    agg_func = "sum" if aggregation.lower() == "sum" else "mean"
    grouped = df.groupby(valid_dims)[valid_metrics].agg(agg_func).reset_index()

    # Convert to JSON-safe dictionary records
    records = []
    for _, row in grouped.iterrows():
        item = {}
        for d in valid_dims:
            item[d] = str(row[d])
        for m in valid_metrics:
            item[m] = round(float(row[m]), 2)
        records.append(item)

    return {
        "dimensions": valid_dims,
        "metrics": valid_metrics,
        "aggregation": agg_func,
        "data": records,
    }
