"""
Grouped Business Analysis Engine.
Computes multi-dimensional aggregations, rankings, share-of-total metrics, and auto-generates chart specifications.
"""

from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd

from backend.app.schemas.analytics import (
    ChartSpec,
    ChartType,
    GroupedMetricResult,
)


class GroupedAnalyzer:
    """
    Performs multi-dimensional aggregations and rankings on business datasets.
    """

    @classmethod
    def aggregate_grouped_metrics(
        cls,
        df: pd.DataFrame,
        dimensions: List[str],
        metrics: List[str],
        aggregation: str = "sum",
        top_n: Optional[int] = None,
        sort_by: Optional[str] = None,
        ascending: bool = False,
    ) -> GroupedMetricResult:
        """
        Aggregate metric columns grouped by one or more dimension columns.

        Args:
            df: Input DataFrame.
            dimensions: List of categorical/dimension column names.
            metrics: List of numeric metric column names.
            aggregation: Aggregation method ('sum', 'mean', 'count', 'min', 'max').
            top_n: Optional limit to top N records.
            sort_by: Column to sort by (defaults to first aggregated metric).
            ascending: Sort order.
        """
        if df.empty:
            return GroupedMetricResult(
                dimensions=dimensions,
                metrics=metrics,
                data=[],
                total_groups=0,
                warnings=["Dataset is empty."],
            )

        # Validate dimensions
        valid_dims = []
        for d in dimensions:
            matched = [c for c in df.columns if c.lower() == d.strip().lower()]
            if matched:
                valid_dims.append(matched[0])
        if not valid_dims:
            raise ValueError(f"None of the specified dimensions {dimensions} were found in the dataset.")

        # Validate metrics
        valid_metrics = []
        for m in metrics:
            matched = [c for c in df.columns if c.lower() == m.strip().lower()]
            if matched and pd.api.types.is_numeric_dtype(df[matched[0]]):
                valid_metrics.append(matched[0])
        if not valid_metrics:
            raise ValueError(f"None of the specified numeric metrics {metrics} were found in the dataset.")

        # Clean dataframe for grouping
        clean_df = df.dropna(subset=valid_dims).copy()
        for m in valid_metrics:
            clean_df[m] = pd.to_numeric(clean_df[m], errors="coerce").fillna(0.0)

        # Group and aggregate
        agg_func = aggregation.lower()
        if agg_func not in {"sum", "mean", "count", "min", "max"}:
            agg_func = "sum"

        grouped = clean_df.groupby(valid_dims, as_index=False)[valid_metrics].agg(agg_func)

        # Add share of total for sums if 1 metric
        if agg_func == "sum" and len(valid_metrics) == 1:
            m_col = valid_metrics[0]
            total_sum = grouped[m_col].sum()
            if total_sum > 0:
                grouped[f"{m_col}_share_pct"] = (grouped[m_col] / total_sum * 100).round(2)

        # Sort
        sort_col = valid_metrics[0]
        if sort_by:
            matched_sort = [c for c in grouped.columns if c.lower() == sort_by.strip().lower()]
            if matched_sort:
                sort_col = matched_sort[0]

        grouped = grouped.sort_values(by=sort_col, ascending=ascending)

        total_groups = len(grouped)

        # Apply top_n slice if specified
        if top_n and top_n > 0:
            grouped = grouped.head(top_n)

        # Convert to serializable records
        records: List[Dict[str, Any]] = []
        for _, row in grouped.iterrows():
            record = {}
            for col in grouped.columns:
                val = row[col]
                if isinstance(val, (np.floating, float)):
                    record[col] = round(float(val), 2)
                elif isinstance(val, (np.integer, int)):
                    record[col] = int(val)
                else:
                    record[col] = str(val)
            records.append(record)

        # Auto-generate chart specification
        chart_spec = cls._build_chart_spec(
            records=records,
            dim_col=valid_dims[0],
            metric_cols=valid_metrics,
            aggregation=agg_func,
        )

        return GroupedMetricResult(
            dimensions=valid_dims,
            metrics=valid_metrics,
            data=records,
            total_groups=total_groups,
            chart_spec=chart_spec,
            warnings=[],
        )

    @staticmethod
    def _build_chart_spec(
        records: List[Dict[str, Any]],
        dim_col: str,
        metric_cols: List[str],
        aggregation: str,
    ) -> ChartSpec:
        """
        Build an interactive chart specification compatible with Recharts (Developer 3).
        """
        chart_type = ChartType.BAR
        # If single metric and <= 6 items, could also be rendered as bar/pie
        title = f"{aggregation.title()} of {', '.join([m.title() for m in metric_cols])} by {dim_col.title()}"

        return ChartSpec(
            chart_type=chart_type,
            title=title,
            x_key=dim_col,
            y_keys=metric_cols,
            data=records,
            x_label=dim_col.replace("_", " ").title(),
            y_label=metric_cols[0].replace("_", " ").title(),
            colors=["#3B82F6", "#10B981", "#F59E0B", "#EF4444"],
        )
