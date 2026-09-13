import time
from typing import Any, Callable, Dict, List, Optional, Set
import pandas as pd

from backend.app.core.errors import ToolExecutionError, ValidationError
from backend.app.tools.analytical_tools import (
    calculate_kpis,
    detect_anomalies,
    detect_trends,
    summarize_grouped_metrics,
)
from backend.app.tools.sql_tool import SafeSQLExecutor

PERMITTED_TOOLS: Set[str] = {
    "run_safe_sql",
    "calculate_kpis",
    "detect_trends",
    "detect_anomalies",
    "summarize_grouped_metrics",
}

class ToolRouter:
    """Routes execution requests exclusively to registered, validated analytical tools."""

    def __init__(self):
        self._registry: Dict[str, Callable] = {
            "run_safe_sql": self._execute_safe_sql,
            "calculate_kpis": self._execute_kpis,
            "detect_trends": self._execute_trends,
            "detect_anomalies": self._execute_anomalies,
            "summarize_grouped_metrics": self._execute_grouped,
        }

    @property
    def permitted_tools(self) -> List[str]:
        return sorted(list(self._registry.keys()))

    def execute_tool(
        self,
        tool_name: str,
        df: pd.DataFrame,
        parameters: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Validate tool permissions, invoke tool, and return execution telemetry."""
        if tool_name not in self._registry:
            raise ValidationError(
                f"Tool '{tool_name}' is not permitted or registered. Available tools: {', '.join(self.permitted_tools)}"
            )

        start_time = time.time()
        try:
            handler = self._registry[tool_name]
            result_payload = handler(df, parameters)
            latency_ms = round((time.time() - start_time) * 1000.0, 2)
            
            return {
                "status": "success",
                "tool": tool_name,
                "latency_ms": latency_ms,
                "payload": result_payload,
            }
        except Exception as e:
            if isinstance(e, (ValidationError, ToolExecutionError)):
                raise
            raise ToolExecutionError(f"Error executing tool '{tool_name}': {str(e)}")

    def _execute_safe_sql(self, df: pd.DataFrame, params: Dict[str, Any]) -> Dict[str, Any]:
        sql = params.get("sql")
        if not sql:
            raise ValidationError("Missing 'sql' parameter for tool 'run_safe_sql'.")
        results, latency_ms, validated_sql = SafeSQLExecutor.execute(df, sql)
        return {
            "query": validated_sql,
            "data": results,
            "row_count": len(results),
        }

    def _execute_kpis(self, df: pd.DataFrame, params: Dict[str, Any]) -> Dict[str, Any]:
        metrics = params.get("metrics")
        return calculate_kpis(df, metrics=metrics)

    def _execute_trends(self, df: pd.DataFrame, params: Dict[str, Any]) -> Dict[str, Any]:
        time_column = params.get("time_column")
        metric = params.get("metric")
        return detect_trends(df, time_column=time_column, metric=metric)

    def _execute_anomalies(self, df: pd.DataFrame, params: Dict[str, Any]) -> Dict[str, Any]:
        feature_columns = params.get("feature_columns")
        contamination = float(params.get("contamination", 0.05))
        return detect_anomalies(df, feature_columns=feature_columns, contamination=contamination)

    def _execute_grouped(self, df: pd.DataFrame, params: Dict[str, Any]) -> Dict[str, Any]:
        dimensions = params.get("dimensions", [])
        metrics = params.get("metrics", [])
        aggregation = params.get("aggregation", "sum")
        return summarize_grouped_metrics(df, dimensions=dimensions, metrics=metrics, aggregation=aggregation)
