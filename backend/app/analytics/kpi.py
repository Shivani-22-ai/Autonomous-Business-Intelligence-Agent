"""
KPI Engine for calculating business metrics and period-over-period growth.
Supports deterministic aggregations: sum, avg, min, max, count, distinct count, profit margin, and growth.
"""

from typing import List, Optional, Tuple
import numpy as np
import pandas as pd

from backend.app.schemas.analytics import (
    KPIEngineResult,
    KPIMetricConfig,
    KPIMetricResult,
    KPIMetricType,
)


class KPIEngine:
    """
    Computes business KPIs strictly from tabular data.
    Never invents or hallucinates metrics when columns are absent.
    """

    @classmethod
    def calculate_single_metric(
        cls,
        df: pd.DataFrame,
        config: KPIMetricConfig,
        df_prev: Optional[pd.DataFrame] = None,
    ) -> KPIMetricResult:
        """
        Calculate a single KPI metric for the current period DataFrame (and optional previous period).
        """
        col = config.target_column.strip().lower()
        # Find matching column case-insensitively
        matching_cols = [c for c in df.columns if c.lower() == col]
        if not matching_cols:
            raise ValueError(f"Target column '{config.target_column}' not found in dataset columns: {list(df.columns)}")
        target_col = matching_cols[0]

        metric_type = config.metric_type
        display_name = config.display_name or config.name.replace("_", " ").title()
        unit = config.unit

        # Compute current value
        val, num_val = cls._compute_value(df, target_col, metric_type, config.cost_column)

        # Compute previous value if df_prev is provided
        prev_val: Optional[float] = None
        change_val: Optional[float] = None
        change_pct: Optional[float] = None

        if df_prev is not None and not df_prev.empty and target_col in df_prev.columns:
            try:
                _, prev_val = cls._compute_value(df_prev, target_col, metric_type, config.cost_column)
                if prev_val is not None:
                    change_val = round(num_val - prev_val, config.precision)
                    if prev_val != 0:
                        change_pct = round(((num_val - prev_val) / abs(prev_val)) * 100, 2)
            except Exception:
                pass

        formatted = cls._format_value(num_val, metric_type, unit, config.precision)

        return KPIMetricResult(
            name=config.name,
            display_name=display_name,
            metric_type=metric_type,
            target_column=target_col,
            value=round(float(num_val), config.precision),
            formatted_value=formatted,
            unit=unit,
            previous_value=round(float(prev_val), config.precision) if prev_val is not None else None,
            change_value=change_val,
            change_percentage=change_pct,
            description=f"{metric_type.value.title()} of {target_col}",
        )

    @classmethod
    def calculate_kpis(
        cls,
        df: pd.DataFrame,
        configs: List[KPIMetricConfig],
        time_column: Optional[str] = None,
    ) -> KPIEngineResult:
        """
        Compute all configured KPIs, optionally splitting by the latest period vs previous period if time_column is given.
        """
        if df.empty:
            return KPIEngineResult(metrics=[], warnings=["Dataset is empty. No KPIs could be calculated."])

        warnings: List[str] = []
        df_curr = df
        df_prev = None
        period_label = "Full Dataset"

        # If time column is provided, split into current period vs previous period
        if time_column:
            matching_time = [c for c in df.columns if c.lower() == time_column.strip().lower()]
            if matching_time:
                t_col = matching_time[0]
                try:
                    df_time = df.copy()
                    df_time["_dt_parsed"] = pd.to_datetime(df_time[t_col], errors="coerce")
                    valid_time = df_time.dropna(subset=["_dt_parsed"])
                    if len(valid_time) > 1:
                        # Group by month or split halfway
                        min_dt = valid_time["_dt_parsed"].min()
                        max_dt = valid_time["_dt_parsed"].max()
                        mid_dt = min_dt + (max_dt - min_dt) / 2
                        df_prev = valid_time[valid_time["_dt_parsed"] < mid_dt]
                        df_curr = valid_time[valid_time["_dt_parsed"] >= mid_dt]
                        period_label = f"Period: {mid_dt.strftime('%Y-%m-%d')} to {max_dt.strftime('%Y-%m-%d')} vs Prior"
                except Exception as e:
                    warnings.append(f"Could not parse time column '{time_column}' for period-over-period comparison: {str(e)}")
            else:
                warnings.append(f"Specified time column '{time_column}' not found.")

        results: List[KPIMetricResult] = []
        for cfg in configs:
            try:
                res = cls.calculate_single_metric(df_curr, cfg, df_prev=df_prev)
                results.append(res)
            except Exception as e:
                warnings.append(f"Failed to calculate KPI '{cfg.name}': {str(e)}")

        return KPIEngineResult(
            metrics=results,
            period_label=period_label,
            warnings=warnings,
        )

    @classmethod
    def auto_discover_kpis(cls, df: pd.DataFrame) -> List[KPIMetricConfig]:
        """
        Automatically identify standard business KPIs from DataFrame columns.
        """
        configs: List[KPIMetricConfig] = []
        cols_lower = {c.lower(): c for c in df.columns}

        # Revenue
        for rev_name in ["revenue", "sales", "total_sales", "amount", "total_amount"]:
            if rev_name in cols_lower:
                configs.append(
                    KPIMetricConfig(
                        name="total_revenue",
                        metric_type=KPIMetricType.SUM,
                        target_column=cols_lower[rev_name],
                        display_name="Total Revenue",
                        unit="$",
                    )
                )
                break

        # Profit & Margin
        for prof_name in ["profit", "net_profit", "earnings"]:
            if prof_name in cols_lower:
                configs.append(
                    KPIMetricConfig(
                        name="total_profit",
                        metric_type=KPIMetricType.SUM,
                        target_column=cols_lower[prof_name],
                        display_name="Total Profit",
                        unit="$",
                    )
                )
                # If we also have revenue, add profit margin
                for rev_name in ["revenue", "sales", "total_sales", "amount"]:
                    if rev_name in cols_lower:
                        configs.append(
                            KPIMetricConfig(
                                name="profit_margin",
                                metric_type=KPIMetricType.MARGIN,
                                target_column=cols_lower[rev_name],
                                cost_column=cols_lower[prof_name],  # Treated as profit/revenue
                                display_name="Profit Margin",
                                unit="%",
                            )
                        )
                        break
                break

        # Units / Volume
        for unit_name in ["units", "quantity", "volume", "order_quantity"]:
            if unit_name in cols_lower:
                configs.append(
                    KPIMetricConfig(
                        name="total_units",
                        metric_type=KPIMetricType.SUM,
                        target_column=cols_lower[unit_name],
                        display_name="Total Volume / Units",
                    )
                )
                break

        # Order Count
        for id_name in ["order_id", "id", "transaction_id", "customer_id"]:
            if id_name in cols_lower:
                configs.append(
                    KPIMetricConfig(
                        name="order_count",
                        metric_type=KPIMetricType.DISTINCT_COUNT,
                        target_column=cols_lower[id_name],
                        display_name="Total Transactions",
                    )
                )
                break

        # If no specific recognized business metrics found, fall back to first numeric columns
        if not configs:
            num_cols = df.select_dtypes(include=[np.number]).columns
            for nc in num_cols[:3]:
                configs.append(
                    KPIMetricConfig(
                        name=f"total_{nc}",
                        metric_type=KPIMetricType.SUM,
                        target_column=nc,
                        display_name=f"Total {nc.title()}",
                    )
                )

        return configs

    @classmethod
    def _compute_value(
        cls,
        df: pd.DataFrame,
        target_col: str,
        metric_type: KPIMetricType,
        cost_col: Optional[str] = None,
    ) -> Tuple[float, float]:
        series = df[target_col]
        
        if metric_type == KPIMetricType.COUNT:
            val = float(len(series))
            return val, val
            
        if metric_type == KPIMetricType.DISTINCT_COUNT:
            val = float(series.nunique(dropna=True))
            return val, val

        # Numeric conversions
        num_s = pd.to_numeric(series, errors="coerce").dropna()
        if len(num_s) == 0:
            return 0.0, 0.0

        if metric_type == KPIMetricType.SUM:
            val = float(num_s.sum())
        elif metric_type == KPIMetricType.AVERAGE:
            val = float(num_s.mean())
        elif metric_type == KPIMetricType.MIN:
            val = float(num_s.min())
        elif metric_type == KPIMetricType.MAX:
            val = float(num_s.max())
        elif metric_type == KPIMetricType.MARGIN:
            # If cost_col provided:
            # Case 1: cost_col is profit -> margin = (profit_sum / revenue_sum) * 100
            # Case 2: cost_col is cost -> margin = ((revenue_sum - cost_sum) / revenue_sum) * 100
            rev_sum = float(num_s.sum())
            if rev_sum == 0:
                val = 0.0
            elif cost_col and cost_col in df.columns:
                other_s = pd.to_numeric(df[cost_col], errors="coerce").dropna()
                other_sum = float(other_s.sum())
                if "profit" in cost_col.lower():
                    # profit / revenue
                    val = float((other_sum / rev_sum) * 100)
                else:
                    # (revenue - cost) / revenue
                    val = float(((rev_sum - other_sum) / rev_sum) * 100)
            else:
                val = 0.0
        elif metric_type == KPIMetricType.GROWTH:
            val = 0.0
        else:
            val = float(num_s.sum())

        return val, val

    @staticmethod
    def _format_value(value: float, metric_type: KPIMetricType, unit: Optional[str], precision: int) -> str:
        if unit == "$":
            if abs(value) >= 1_000_000:
                return f"${value / 1_000_000:.2f}M"
            elif abs(value) >= 1_000:
                return f"${value / 1_000:.2f}K"
            else:
                return f"${value:,.{precision}f}"
        elif unit == "%" or metric_type == KPIMetricType.MARGIN:
            return f"{value:.{precision}f}%"
        elif metric_type in {KPIMetricType.COUNT, KPIMetricType.DISTINCT_COUNT}:
            return f"{int(round(value)):,}"
        else:
            if abs(value) >= 1_000_000:
                return f"{value / 1_000_000:.2f}M"
            elif abs(value) >= 1_000:
                return f"{value / 1_000:.2f}K"
            else:
                return f"{value:,.{precision}f}"
