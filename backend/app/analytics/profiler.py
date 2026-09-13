"""
Automatic schema and data-quality profiler.
Inspects tabular datasets to dynamically infer column data types, calculate descriptive statistics,
identify potential business date/numeric/categorical dimensions, and flag data quality issues.
"""

from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd

from backend.app.schemas.dataset import (
    ColumnProfile,
    ColumnType,
    DataQualityIssue,
    DataQualitySummary,
    DatasetProfile,
)


class DatasetProfiler:
    """
    Analyzes Pandas DataFrames without hardcoded schema assumptions.
    """

    @classmethod
    def infer_column_type(cls, series: pd.Series) -> ColumnType:
        """
        Infer high-level business data type for a Series.
        """
        # Drop NAs for type inspection
        non_nulls = series.dropna()
        if len(non_nulls) == 0:
            return ColumnType.UNKNOWN

        # Check Boolean
        if pd.api.types.is_bool_dtype(series):
            return ColumnType.BOOLEAN
        
        # Check explicit numeric
        if pd.api.types.is_numeric_dtype(series):
            # If it only has 0 and 1 and low cardinality, might be boolean
            unique_vals = set(non_nulls.unique())
            if unique_vals.issubset({0, 1, 0.0, 1.0}) and len(unique_vals) <= 2:
                # Still often used as numeric/flag, but if name implies flag, treat as boolean
                name_lower = str(series.name).lower()
                if name_lower.startswith("is_") or name_lower.startswith("has_"):
                    return ColumnType.BOOLEAN
            return ColumnType.NUMERIC

        # Check explicit datetime
        if pd.api.types.is_datetime64_any_dtype(series):
            return ColumnType.DATETIME

        # Attempt to parse strings as datetime if candidate keywords or formats exist
        if pd.api.types.is_string_dtype(series) or pd.api.types.is_object_dtype(series):
            # Sample check for datetime
            sample = non_nulls.head(20).astype(str)
            col_name = str(series.name).lower()
            date_keywords = ["date", "time", "timestamp", "year", "month", "day", "created", "updated", "period"]
            has_date_keyword = any(k in col_name for k in date_keywords)

            # Try parsing sample
            try:
                # Check if sample strings look like dates (at least 6 chars and digits)
                if all(len(s) >= 4 and any(c.isdigit() for c in s) for s in sample):
                    pd.to_datetime(sample, errors="raise", format="mixed")
                    # If sample parsed cleanly, verify with entire series
                    try:
                        pd.to_datetime(non_nulls, errors="raise", format="mixed")
                        return ColumnType.DATETIME
                    except Exception:
                        pass
            except Exception:
                pass

            # Check if strings are numeric
            try:
                pd.to_numeric(non_nulls, errors="raise")
                return ColumnType.NUMERIC
            except Exception:
                pass

            # Check cardinality for Categorical vs Text
            unique_count = series.nunique()
            total_count = len(non_nulls)
            if unique_count <= 50 or (total_count > 0 and (unique_count / total_count) < 0.20):
                return ColumnType.CATEGORICAL
            else:
                return ColumnType.TEXT

        return ColumnType.UNKNOWN

    @classmethod
    def profile_column(cls, series: pd.Series) -> ColumnProfile:
        """
        Generate statistical and metadata profile for a single column.
        """
        col_name = str(series.name)
        total_rows = len(series)
        null_count = int(series.isna().sum())
        null_pct = round((null_count / total_rows) * 100, 2) if total_rows > 0 else 0.0
        unique_count = int(series.nunique(dropna=True))
        col_type = cls.infer_column_type(series)

        # Get non-null samples (safe values)
        non_null_series = series.dropna()
        sample_values = [
            cls._make_json_safe(v) for v in non_null_series.head(5).tolist()
        ]

        stats: Dict[str, Any] = {}

        if col_type == ColumnType.NUMERIC:
            # Convert series to numeric safely
            num_s = pd.to_numeric(non_null_series, errors="coerce").dropna()
            if len(num_s) > 0:
                stats = {
                    "min": cls._make_json_safe(float(num_s.min())),
                    "max": cls._make_json_safe(float(num_s.max())),
                    "mean": cls._make_json_safe(round(float(num_s.mean()), 4)),
                    "median": cls._make_json_safe(round(float(num_s.median()), 4)),
                    "std": cls._make_json_safe(round(float(num_s.std()), 4) if len(num_s) > 1 else 0.0),
                    "q25": cls._make_json_safe(round(float(num_s.quantile(0.25)), 4)),
                    "q75": cls._make_json_safe(round(float(num_s.quantile(0.75)), 4)),
                }
        elif col_type == ColumnType.DATETIME:
            try:
                date_s = pd.to_datetime(non_null_series, errors="coerce").dropna()
                if len(date_s) > 0:
                    min_dt = date_s.min()
                    max_dt = date_s.max()
                    stats = {
                        "min_date": min_dt.isoformat(),
                        "max_date": max_dt.isoformat(),
                        "span_days": int((max_dt - min_dt).days),
                    }
            except Exception:
                pass
        elif col_type in {ColumnType.CATEGORICAL, ColumnType.TEXT}:
            # Top frequency values
            if len(non_null_series) > 0:
                top_counts = non_null_series.value_counts().head(5)
                stats = {
                    "top_values": [
                        {"value": cls._make_json_safe(val), "count": int(cnt), "percentage": round((cnt / len(non_null_series)) * 100, 2)}
                        for val, cnt in top_counts.items()
                    ]
                }
        elif col_type == ColumnType.BOOLEAN:
            # Boolean distribution
            bool_s = non_null_series.astype(bool)
            true_cnt = int(bool_s.sum())
            false_cnt = len(bool_s) - true_cnt
            stats = {
                "true_count": true_cnt,
                "false_count": false_cnt,
                "true_percentage": round((true_cnt / len(bool_s)) * 100, 2) if len(bool_s) > 0 else 0.0,
            }

        return ColumnProfile(
            name=col_name,
            inferred_type=col_type,
            nullable=null_count > 0,
            null_count=null_count,
            null_percentage=null_pct,
            unique_count=unique_count,
            sample_values=sample_values,
            stats=stats,
        )

    @classmethod
    def evaluate_data_quality(cls, df: pd.DataFrame, column_profiles: List[ColumnProfile]) -> DataQualitySummary:
        """
        Evaluate dataset-wide health, missingness, duplicates, and column anomalies.
        """
        total_cells = df.shape[0] * df.shape[1]
        total_missing = int(df.isna().sum().sum())
        missing_pct = round((total_missing / total_cells) * 100, 2) if total_cells > 0 else 0.0
        duplicate_count = int(df.duplicated().sum())

        constant_cols = []
        high_missing_cols = []
        issues: List[DataQualityIssue] = []

        for cp in column_profiles:
            # Check for constant / zero variance columns
            if cp.unique_count <= 1 and df.shape[0] > 1:
                constant_cols.append(cp.name)
                issues.append(
                    DataQualityIssue(
                        severity="warning",
                        column=cp.name,
                        issue_type="constant_column",
                        message=f"Column '{cp.name}' contains only 1 unique value across all rows.",
                    )
                )

            # Check for high missingness (> 40%)
            if cp.null_percentage > 40.0:
                high_missing_cols.append(cp.name)
                issues.append(
                    DataQualityIssue(
                        severity="warning",
                        column=cp.name,
                        issue_type="high_missingness",
                        message=f"Column '{cp.name}' has {cp.null_percentage}% missing values.",
                    )
                )

        if duplicate_count > 0:
            issues.append(
                DataQualityIssue(
                    severity="info",
                    issue_type="duplicate_rows",
                    message=f"Dataset contains {duplicate_count} duplicate rows.",
                )
            )

        return DataQualitySummary(
            is_valid=True,
            total_missing_cells=total_missing,
            missing_percentage=missing_pct,
            duplicate_row_count=duplicate_count,
            constant_columns=constant_cols,
            high_missingness_columns=high_missing_cols,
            issues=issues,
        )

    @classmethod
    def profile_dataframe(
        cls,
        df: pd.DataFrame,
        dataset_id: str,
        filename: str = "dataset.csv",
        file_type: str = "csv",
    ) -> DatasetProfile:
        """
        Profile an entire DataFrame and return a complete DatasetProfile.
        """
        col_profiles = [cls.profile_column(df[col]) for col in df.columns]
        quality_summary = cls.evaluate_data_quality(df, col_profiles)

        # Create clean preview (first 5 rows)
        preview_df = df.head(5).copy()
        # Convert preview to json-safe dicts
        preview_records = []
        for _, row in preview_df.iterrows():
            record = {k: cls._make_json_safe(v) for k, v in row.items()}
            preview_records.append(record)

        return DatasetProfile(
            dataset_id=dataset_id,
            filename=filename,
            file_type=file_type,
            row_count=len(df),
            column_count=len(df.columns),
            columns=col_profiles,
            quality_summary=quality_summary,
            preview=preview_records,
        )

    @staticmethod
    def _make_json_safe(val: Any) -> Any:
        """Convert numpy/pandas types to standard JSON serializable Python types."""
        if pd.isna(val):
            return None
        if isinstance(val, (np.integer, int)):
            return int(val)
        if isinstance(val, (np.floating, float)):
            if np.isinf(val) or np.isnan(val):
                return None
            return float(val)
        if isinstance(val, (pd.Timestamp, np.datetime64)):
            return pd.Timestamp(val).isoformat()
        if isinstance(val, np.bool_):
            return bool(val)
        return str(val) if not isinstance(val, (str, bool, int, float, list, dict)) else val
