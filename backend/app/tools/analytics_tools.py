"""
Typed, safe analytical tools for AI Agent integration.
Exposes bounded functions conforming to Developer 1 & Developer 2 contracts.
"""

import uuid
from typing import Any, Dict, List, Optional, Union
import pandas as pd

from backend.app.analytics.profiler import DatasetProfiler
from backend.app.analytics.kpi import KPIEngine
from backend.app.analytics.trends import TrendAnalyzer
from backend.app.analytics.anomalies import AnomalyDetector
from backend.app.analytics.grouped import GroupedAnalyzer
from backend.app.schemas.dataset import DatasetProfile
from backend.app.schemas.analytics import (
    AnalysisResult,
    AnalysisType,
    AnomalyResult,
    ChartSpec,
    ChartType,
    GroupedMetricResult,
    KPIEngineResult,
    KPIMetricConfig,
    KPIMetricType,
    TrendResult,
)


def profile_dataset(
    df: pd.DataFrame,
    dataset_id: Optional[str] = None,
    filename: str = "dataset.csv",
    file_type: str = "csv",
) -> DatasetProfile:
    """
    Profile a dataset without assuming fixed column schemas.

    Args:
        df: The pandas DataFrame.
        dataset_id: Optional UUID string identifier.
        filename: Name of the uploaded file.
        file_type: Extension type ('csv', 'xlsx', etc.).

    Returns:
        DatasetProfile with column profiles, types, statistics, and quality health alerts.
    """
    assigned_id = dataset_id or str(uuid.uuid4())
    return DatasetProfiler.profile_dataframe(
        df=df,
        dataset_id=assigned_id,
        filename=filename,
        file_type=file_type,
    )


def calculate_kpis(
    df: pd.DataFrame,
    metric_configs: Optional[List[Union[Dict[str, Any], KPIMetricConfig]]] = None,
    time_column: Optional[str] = None,
) -> KPIEngineResult:
    """
    Calculate summary KPIs and optional period-over-period growth.

    Args:
        df: The pandas DataFrame.
        metric_configs: List of KPIMetricConfig or config dicts. If None, auto-discovers KPIs.
        time_column: Optional date/time column for period comparisons.

    Returns:
        KPIEngineResult with computed metrics and formatted values.
    """
    if metric_configs is None:
        configs = KPIEngine.auto_discover_kpis(df)
    else:
        configs = []
        for c in metric_configs:
            if isinstance(c, KPIMetricConfig):
                configs.append(c)
            elif isinstance(c, dict):
                # Coerce metric_type if string
                m_type = c.get("metric_type", "sum")
                if isinstance(m_type, str):
                    m_type = KPIMetricType(m_type.lower())
                configs.append(
                    KPIMetricConfig(
                        name=c["name"],
                        metric_type=m_type,
                        target_column=c["target_column"],
                        cost_column=c.get("cost_column"),
                        display_name=c.get("display_name"),
                        unit=c.get("unit"),
                        precision=c.get("precision", 2),
                    )
                )

    return KPIEngine.calculate_kpis(df, configs, time_column=time_column)


def detect_trends(
    df: pd.DataFrame,
    time_column: str,
    metric_column: str,
    frequency: Optional[str] = None,
    aggregation: str = "sum",
    group_by: Optional[str] = None,
) -> TrendResult:
    """
    Detect time-series trends, rate of growth, direction, and turning points.

    Args:
        df: The pandas DataFrame.
        time_column: Name of the timestamp/date column.
        metric_column: Name of the numeric metric column.
        frequency: Aggregation frequency ('D', 'W', 'ME', 'QE', 'YE', or None for auto).
        aggregation: Aggregation method ('sum', 'mean', 'count').
        group_by: Optional dimension column for filtering.

    Returns:
        TrendResult with periodic trend points, trajectory classification, and business insights.
    """
    return TrendAnalyzer.analyze_trend(
        df=df,
        time_column=time_column,
        metric_column=metric_column,
        frequency=frequency,
        aggregation=aggregation,
        group_by=group_by,
    )


def detect_anomalies(
    df: pd.DataFrame,
    feature_columns: Optional[List[str]] = None,
    contamination: float = 0.05,
) -> AnomalyResult:
    """
    Run unsupervised multi-feature anomaly detection using Isolation Forest.

    Args:
        df: The pandas DataFrame.
        feature_columns: Specific numeric columns to analyze (or None for all numeric).
        contamination: Expected outlier percentage (0.01 to 0.20).

    Returns:
        AnomalyResult with identified anomalous records, anomaly scores, and feature attribution.
    """
    return AnomalyDetector.detect_anomalies(
        df=df,
        feature_columns=feature_columns,
        contamination=contamination,
    )


def summarize_grouped_metrics(
    df: pd.DataFrame,
    dimensions: List[str],
    metrics: List[str],
    aggregation: str = "sum",
    top_n: Optional[int] = None,
    sort_by: Optional[str] = None,
    ascending: bool = False,
) -> GroupedMetricResult:
    """
    Perform multi-dimensional aggregation, ranking, and share-of-total analysis.

    Args:
        df: The pandas DataFrame.
        dimensions: List of dimension column names (e.g. ['region', 'product']).
        metrics: List of metric column names (e.g. ['revenue', 'profit']).
        aggregation: 'sum', 'mean', 'count', etc.
        top_n: Optional limit to top N records.
        sort_by: Column to sort by.
        ascending: Sort order.

    Returns:
        GroupedMetricResult with data table and Recharts-compatible ChartSpec.
    """
    return GroupedAnalyzer.aggregate_grouped_metrics(
        df=df,
        dimensions=dimensions,
        metrics=metrics,
        aggregation=aggregation,
        top_n=top_n,
        sort_by=sort_by,
        ascending=ascending,
    )


def run_safe_analysis(
    df: pd.DataFrame,
    analysis_type: Union[str, AnalysisType],
    params: Optional[Dict[str, Any]] = None,
) -> AnalysisResult:
    """
    Unified bounded entry point for the AI agent to run safe, validated analytical tasks.

    Args:
        df: The pandas DataFrame.
        analysis_type: 'kpi', 'trend', 'anomaly', 'grouped', or 'profile'.
        params: Parameter dictionary for the selected analysis.

    Returns:
        AnalysisResult containing structured data, chart spec, insights, and warnings.
    """
    params = params or {}
    result_id = str(uuid.uuid4())
    a_type = analysis_type.value if isinstance(analysis_type, AnalysisType) else str(analysis_type).lower()

    if a_type == "profile":
        profile = profile_dataset(df, filename=params.get("filename", "dataset.csv"))
        return AnalysisResult(
            status="success",
            tool="profile_dataset",
            reason="Profiled dataset schema and data quality health.",
            result_id=result_id,
            data=profile.model_dump(),
            insights=[
                f"Dataset contains {profile.row_count} rows and {profile.column_count} columns.",
                f"Data quality health: {len(profile.quality_summary.issues)} issues detected.",
            ],
            warnings=[i.message for i in profile.quality_summary.issues if i.severity == "warning"],
        )

    elif a_type == "kpi":
        kpi_res = calculate_kpis(
            df=df,
            metric_configs=params.get("metrics"),
            time_column=params.get("time_column"),
        )
        return AnalysisResult(
            status="success",
            tool="calculate_kpis",
            reason=f"Calculated {len(kpi_res.metrics)} business KPIs.",
            result_id=result_id,
            data=kpi_res.model_dump(),
            insights=[f"{m.display_name}: {m.formatted_value}" for m in kpi_res.metrics],
            warnings=kpi_res.warnings,
        )

    elif a_type == "trend":
        time_col = params.get("time_column")
        metric_col = params.get("metric_column")
        if not time_col or not metric_col:
            raise ValueError("Parameters 'time_column' and 'metric_column' are required for trend analysis.")

        trend_res = detect_trends(
            df=df,
            time_column=time_col,
            metric_column=metric_col,
            frequency=params.get("frequency"),
            aggregation=params.get("aggregation", "sum"),
        )

        chart_data = [{"period": p.period, metric_col: p.metric_value, "moving_avg": p.moving_average} for p in trend_res.points]
        chart_spec = ChartSpec(
            chart_type=ChartType.LINE,
            title=f"{metric_col.replace('_', ' ').title()} Over Time ({trend_res.overall_direction.value.title()})",
            x_key="period",
            y_keys=[metric_col, "moving_avg"],
            data=chart_data,
            x_label="Period",
            y_label=metric_col.replace("_", " ").title(),
            colors=["#3B82F6", "#9CA3AF"],
        )

        return AnalysisResult(
            status="success",
            tool="detect_trends",
            reason=f"Analyzed {metric_col} trend over {time_col}.",
            result_id=result_id,
            chart_spec=chart_spec,
            insights=trend_res.insights,
            warnings=trend_res.warnings,
            data=trend_res.model_dump(),
        )

    elif a_type == "anomaly":
        anomaly_res = detect_anomalies(
            df=df,
            feature_columns=params.get("feature_columns"),
            contamination=params.get("contamination", 0.05),
        )

        # Scatter / Bar chart spec for anomalies
        chart_data = [
            {
                "record_id": a.record_id,
                "anomaly_score": a.anomaly_score,
                "explanation": a.explanation,
                **{k: v for k, v in a.record_data.items() if isinstance(v, (int, float))},
            }
            for a in anomaly_res.anomalies
        ]
        chart_spec = ChartSpec(
            chart_type=ChartType.SCATTER if len(anomaly_res.features_analyzed) >= 2 else ChartType.BAR,
            title=f"Detected Anomalies ({anomaly_res.anomaly_count} flagged)",
            x_key=anomaly_res.features_analyzed[0] if anomaly_res.features_analyzed else "record_id",
            y_keys=[anomaly_res.features_analyzed[1]] if len(anomaly_res.features_analyzed) >= 2 else ["anomaly_score"],
            data=chart_data,
            colors=["#EF4444"],
        )

        return AnalysisResult(
            status="success",
            tool="detect_anomalies",
            reason=f"Identified {anomaly_res.anomaly_count} anomalies using Isolation Forest.",
            result_id=result_id,
            chart_spec=chart_spec,
            insights=anomaly_res.insights,
            warnings=anomaly_res.warnings,
            data=anomaly_res.model_dump(),
        )

    elif a_type == "grouped":
        dims = params.get("dimensions", [])
        metrics = params.get("metrics", [])
        if not dims or not metrics:
            raise ValueError("Parameters 'dimensions' and 'metrics' are required for grouped analysis.")

        grouped_res = summarize_grouped_metrics(
            df=df,
            dimensions=dims,
            metrics=metrics,
            aggregation=params.get("aggregation", "sum"),
            top_n=params.get("top_n"),
            sort_by=params.get("sort_by"),
            ascending=params.get("ascending", False),
        )

        return AnalysisResult(
            status="success",
            tool="summarize_grouped_metrics",
            reason=f"Aggregated {', '.join(metrics)} across {', '.join(dims)}.",
            result_id=result_id,
            chart_spec=grouped_res.chart_spec,
            insights=[
                f"Generated {grouped_res.total_groups} group records across {', '.join(dims)}.",
            ],
            warnings=grouped_res.warnings,
            data=grouped_res.model_dump(),
        )

    else:
        raise ValueError(f"Unsupported analysis type '{analysis_type}'. Allowed: profile, kpi, trend, anomaly, grouped.")
