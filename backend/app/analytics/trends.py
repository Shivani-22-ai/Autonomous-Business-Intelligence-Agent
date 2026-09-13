"""
Trend Detection Engine.
Aggregates time-series data, analyzes velocity/growth, calculates rolling averages,
identifies peak/trough periods, and evaluates overall trajectory (upward, downward, flat, volatile).
"""

from typing import List, Optional
import numpy as np
import pandas as pd

from backend.app.schemas.analytics import (
    ChartSpec,
    ChartType,
    TrendDirection,
    TrendPoint,
    TrendResult,
)


class TrendAnalyzer:
    """
    Analyzes business trends over time for given numeric metrics.
    """

    @classmethod
    def analyze_trend(
        cls,
        df: pd.DataFrame,
        time_column: str,
        metric_column: str,
        frequency: Optional[str] = None,
        aggregation: str = "sum",
        group_by: Optional[str] = None,
    ) -> TrendResult:
        """
        Analyze the trend of a metric over time.

        Args:
            df: Input DataFrame.
            time_column: Name of the datetime/date column.
            metric_column: Name of the numerical metric column.
            frequency: Resampling frequency ('D', 'W', 'ME', 'QE', 'YE', or None for auto).
            aggregation: Aggregation method ('sum', 'mean', 'count').
            group_by: Optional category column to filter/segment.
        """
        # Column validation
        time_col = cls._find_column(df, time_column)
        if not time_col:
            raise ValueError(f"Time column '{time_column}' not found in dataset columns.")

        metric_col = cls._find_column(df, metric_column)
        if not metric_col:
            raise ValueError(f"Metric column '{metric_column}' not found in dataset columns.")

        # Clean and parse datetime
        temp_df = df.copy()
        temp_df["_parsed_dt"] = pd.to_datetime(temp_df[time_col], errors="coerce")
        temp_df["_metric_num"] = pd.to_numeric(temp_df[metric_col], errors="coerce")

        valid_df = temp_df.dropna(subset=["_parsed_dt", "_metric_num"]).sort_values("_parsed_dt")

        if len(valid_df) < 2:
            raise ValueError(f"Insufficient valid time-series observations for trend analysis (found {len(valid_df)}).")

        # Determine frequency if not provided
        min_dt = valid_df["_parsed_dt"].min()
        max_dt = valid_df["_parsed_dt"].max()
        span_days = (max_dt - min_dt).days

        if frequency is None:
            if span_days > 730:
                freq = "QE"  # Quarterly
            elif span_days > 90:
                freq = "ME"  # Monthly
            elif span_days > 14:
                freq = "W"   # Weekly
            else:
                freq = "D"   # Daily
        else:
            freq = frequency

        # Set index and resample
        valid_df.set_index("_parsed_dt", inplace=True)
        if aggregation == "mean":
            resampled = valid_df["_metric_num"].resample(freq).mean().dropna()
        elif aggregation == "count":
            resampled = valid_df["_metric_num"].resample(freq).count().dropna()
        else:
            resampled = valid_df["_metric_num"].resample(freq).sum().dropna()

        if len(resampled) == 0:
            raise ValueError("No aggregated periods could be formed from the dataset.")

        # Calculate period changes, percentage changes, and rolling moving average
        points: List[TrendPoint] = []
        values = resampled.values
        dates = resampled.index

        # 3-period moving average (or 2 if fewer periods)
        window = min(3, len(values))
        rolling_series = resampled.rolling(window=window, min_periods=1).mean()

        for i in range(len(values)):
            curr_val = round(float(values[i]), 2)
            prev_val = round(float(values[i - 1]), 2) if i > 0 else None
            change = round(curr_val - prev_val, 2) if prev_val is not None else None
            change_pct = round(((curr_val - prev_val) / abs(prev_val)) * 100, 2) if (prev_val is not None and prev_val != 0) else None
            m_avg = round(float(rolling_series.iloc[i]), 2)

            # Format period string nicely
            if "M" in freq:
                period_str = dates[i].strftime("%Y-%m")
            elif "Q" in freq:
                period_str = f"{dates[i].year}-Q{(dates[i].month - 1) // 3 + 1}"
            elif "Y" in freq:
                period_str = dates[i].strftime("%Y")
            else:
                period_str = dates[i].strftime("%Y-%m-%d")

            points.append(
                TrendPoint(
                    period=period_str,
                    metric_value=curr_val,
                    change=change,
                    change_percentage=change_pct,
                    moving_average=m_avg,
                )
            )

        start_val = round(float(values[0]), 2)
        end_val = round(float(values[-1]), 2)
        total_growth_pct = round(((end_val - start_val) / abs(start_val)) * 100, 2) if start_val != 0 else 0.0

        # Peak and Trough
        peak_idx = int(np.argmax(values))
        trough_idx = int(np.argmin(values))
        peak_period = points[peak_idx].period
        peak_val = points[peak_idx].metric_value
        trough_period = points[trough_idx].period
        trough_val = points[trough_idx].metric_value

        # Trajectory determination
        overall_dir = cls._classify_direction(values, total_growth_pct)

        # Generate structured business insights
        insights = cls._generate_insights(
            metric_col, time_col, freq, overall_dir, total_growth_pct, points, peak_period, peak_val, trough_period, trough_val
        )

        return TrendResult(
            metric_column=metric_col,
            time_column=time_col,
            frequency=freq,
            overall_direction=overall_dir,
            total_growth_percentage=total_growth_pct,
            start_value=start_val,
            end_value=end_val,
            points=points,
            peak_period=peak_period,
            peak_value=peak_val,
            trough_period=trough_period,
            trough_value=trough_val,
            insights=insights,
            warnings=[],
        )

    @staticmethod
    def _classify_direction(values: np.ndarray, total_growth_pct: float) -> TrendDirection:
        if len(values) < 2:
            return TrendDirection.FLAT

        # Calculate standard deviation of period-to-period differences relative to mean
        diffs = np.diff(values)
        mean_val = np.mean(np.abs(values)) if np.mean(np.abs(values)) > 0 else 1.0
        volatility = np.std(diffs) / mean_val

        if volatility > 0.60 and abs(total_growth_pct) < 30:
            return TrendDirection.VOLATILE

        if total_growth_pct > 5.0:
            return TrendDirection.UPWARD
        elif total_growth_pct < -5.0:
            return TrendDirection.DOWNWARD
        else:
            return TrendDirection.FLAT

    @staticmethod
    def _generate_insights(
        metric: str,
        time_col: str,
        freq: str,
        direction: TrendDirection,
        growth_pct: float,
        points: List[TrendPoint],
        peak_p: str,
        peak_v: float,
        trough_p: str,
        trough_v: float,
    ) -> List[str]:
        insights = []
        growth_str = f"+{growth_pct}%" if growth_pct > 0 else f"{growth_pct}%"
        insights.append(
            f"{metric.replace('_', ' ').title()} exhibits an overall {direction.value} trend ({growth_str} total change across {len(points)} periods)."
        )
        insights.append(
            f"Highest peak occurred in {peak_p} at {peak_v:,.2f}, while lowest trough was recorded in {trough_p} at {trough_v:,.2f}."
        )

        # Recent momentum
        if len(points) >= 3:
            recent_changes = [p.change for p in points[-2:] if p.change is not None]
            if all(c > 0 for c in recent_changes):
                insights.append("Recent momentum is positive with consecutive period-over-period increases.")
            elif all(c < 0 for c in recent_changes):
                insights.append("Recent momentum has slowed with consecutive period-over-period decreases.")

        return insights

    @staticmethod
    def _find_column(df: pd.DataFrame, col_name: str) -> Optional[str]:
        target = col_name.strip().lower()
        for c in df.columns:
            if c.lower() == target:
                return c
        return None
