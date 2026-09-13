from typing import Any, Dict, List, Optional, Tuple
from backend.app.schemas.dataset import ColumnDescription

class ResultValidator:
    """Validates analytical execution results, generates grounded insights and chart specs."""

    @classmethod
    def validate_and_format(
        cls,
        tool: str,
        question: str,
        payload: Dict[str, Any],
        columns: List[ColumnDescription],
    ) -> Tuple[Dict[str, Any], List[str], List[str], List[Dict[str, Any]]]:
        """
        Returns:
            chart_spec: Dict[str, Any]
            insights: List[str]
            warnings: List[str]
            preview_data: List[Dict[str, Any]]
        """
        warnings: List[str] = []
        insights: List[str] = []
        preview_data: List[Dict[str, Any]] = []
        chart_spec: Dict[str, Any] = {}

        if tool == "run_safe_sql":
            data = payload.get("data", [])
            preview_data = data[:10]
            if not data:
                warnings.append("Query executed successfully but returned 0 rows.")
                insights.append("No records matched the specified query conditions.")
                chart_spec = cls._empty_chart_spec(question)
            else:
                insights.extend(cls._extract_sql_insights(data, question))
                chart_spec = cls._build_chart_from_tabular(data, question)

        elif tool == "calculate_kpis":
            kpis = payload.get("kpis", {})
            total_records = payload.get("record_count", 0)
            if not kpis:
                warnings.append("No numeric metrics could be computed.")
                insights.append("No KPI metrics available.")
                chart_spec = cls._empty_chart_spec(question)
            else:
                for metric_name, stats in kpis.items():
                    insights.append(
                        f"Metric '{metric_name}': Total = {stats.get('sum'):,}, Average = {stats.get('mean'):,}, "
                        f"Min = {stats.get('min'):,}, Max = {stats.get('max'):,} across {stats.get('count')} records."
                    )
                preview_data = [{"metric": k, **v} for k, v in kpis.items()]
                chart_spec = {
                    "chart_type": "metric_card",
                    "title": f"Key Performance Indicators ({question})",
                    "data": preview_data,
                    "description": f"Computed statistics over {total_records} records.",
                }

        elif tool == "detect_trends":
            trend_data = payload.get("data", [])
            metric = payload.get("metric", "value")
            direction = payload.get("trend_direction", "stable")
            rate = payload.get("growth_rate_pct", 0.0)
            preview_data = trend_data[:10]

            if not trend_data:
                warnings.append("No chronological data points available for trend detection.")
                insights.append("Insufficient data to establish a chronological trend.")
                chart_spec = cls._empty_chart_spec(question)
            else:
                insights.append(
                    f"Overall trend for '{metric}' is {direction} with an estimated net change of {rate}% over the observation period."
                )
                chart_spec = {
                    "chart_type": "line",
                    "title": f"Chronological Trend: {metric}",
                    "x_axis": "date",
                    "y_axis": metric,
                    "series": [metric],
                    "data": trend_data,
                    "description": f"Direction: {direction}, Growth rate: {rate}%.",
                }

        elif tool == "detect_anomalies":
            anomalies = payload.get("anomalies", [])
            count = payload.get("anomalies_count", 0)
            features = payload.get("feature_columns", [])
            preview_data = anomalies[:10]

            if count == 0:
                insights.append("No statistical anomalies or outliers were detected in the specified features.")
            else:
                insights.append(f"Identified {count} statistical outlier records across features: {', '.join(features)}.")

            chart_spec = {
                "chart_type": "scatter" if len(features) >= 2 else "table",
                "title": f"Outlier Analysis ({', '.join(features)})",
                "x_axis": features[0] if len(features) >= 1 else "index",
                "y_axis": features[1] if len(features) >= 2 else "value",
                "series": features,
                "data": anomalies,
                "description": f"{count} anomalies detected.",
            }

        elif tool == "summarize_grouped_metrics":
            group_data = payload.get("data", [])
            dims = payload.get("dimensions", [])
            metrics = payload.get("metrics", [])
            preview_data = group_data[:10]

            if not group_data:
                warnings.append("Grouped aggregation produced empty results.")
                insights.append("No records available for the requested grouping.")
                chart_spec = cls._empty_chart_spec(question)
            else:
                dim = dims[0]
                metric = metrics[0]
                # Find top performer
                sorted_records = sorted(group_data, key=lambda x: x.get(metric, 0), reverse=True)
                top_group = sorted_records[0]
                insights.append(
                    f"In grouped breakdown by '{dim}', the highest '{metric}' was observed in '{top_group.get(dim)}' with {top_group.get(metric):,}."
                )
                chart_type = "pie" if len(group_data) <= 6 else "bar"
                chart_spec = {
                    "chart_type": chart_type,
                    "title": f"{metric} by {dim}",
                    "x_axis": dim,
                    "y_axis": metric,
                    "series": [metric],
                    "data": group_data,
                    "description": f"Aggregated {metric} grouped across {len(group_data)} distinct {dim} segments.",
                }
        else:
            warnings.append(f"Unrecognized tool: '{tool}'.")
            insights.append("Execution completed with unrecognized output format.")
            chart_spec = cls._empty_chart_spec(question)

        return chart_spec, insights, warnings, preview_data

    @classmethod
    def _extract_sql_insights(cls, data: List[Dict[str, Any]], question: str) -> List[str]:
        if not data:
            return []
        keys = list(data[0].keys())
        insights = [f"Retrieved {len(data)} rows matching criteria."]

        # Check if first row contains aggregate sum/avg
        numeric_keys = [k for k, v in data[0].items() if isinstance(v, (int, float))]
        cat_keys = [k for k, v in data[0].items() if isinstance(v, str)]

        if numeric_keys and cat_keys:
            dim = cat_keys[0]
            val_col = numeric_keys[0]
            top = data[0]
            insights.append(f"Top category by {val_col}: '{top.get(dim)}' with {top.get(val_col):,}.")
        elif len(data) == 1 and numeric_keys:
            stats_str = ", ".join(f"{k} = {v:,}" for k, v in data[0].items())
            insights.append(f"Calculated aggregates: {stats_str}.")
        return insights

    @classmethod
    def _build_chart_from_tabular(cls, data: List[Dict[str, Any]], question: str) -> Dict[str, Any]:
        if not data:
            return cls._empty_chart_spec(question)

        first_row = data[0]
        string_cols = [k for k, v in first_row.items() if isinstance(v, str)]
        num_cols = [k for k, v in first_row.items() if isinstance(v, (int, float))]

        if string_cols and num_cols:
            x_col = string_cols[0]
            y_col = num_cols[0]
            chart_type = "bar"
            if any(d in x_col.lower() for d in ["date", "time", "month", "year"]):
                chart_type = "line"
            elif len(data) <= 5:
                chart_type = "pie"

            return {
                "chart_type": chart_type,
                "title": f"{y_col} by {x_col}",
                "x_axis": x_col,
                "y_axis": y_col,
                "series": [y_col],
                "data": data,
                "description": f"Visualizing {y_col} across {x_col}.",
            }
        elif len(data) == 1 and num_cols:
            return {
                "chart_type": "metric_card",
                "title": "Aggregated Metric Summary",
                "data": data,
                "description": "Computed aggregated values.",
            }
        else:
            return {
                "chart_type": "table",
                "title": "Query Result Table",
                "data": data,
                "description": f"{len(data)} rows returned.",
            }

    @staticmethod
    def _empty_chart_spec(question: str) -> Dict[str, Any]:
        return {
            "chart_type": "table",
            "title": f"Analysis: {question}",
            "data": [],
            "description": "No data returned for this query.",
        }
