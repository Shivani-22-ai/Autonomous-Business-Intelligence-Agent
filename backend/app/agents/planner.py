from typing import Any, Dict, List, Optional
from backend.app.agents.provider import LLMProviderAdapter
from backend.app.agents.text_to_sql import TextToSQLGenerator
from backend.app.core.errors import ValidationError
from backend.app.schemas.analysis import AgentPlanOutput
from backend.app.schemas.dataset import ColumnDescription

class AgentPlanner:
    """Plans analytical workflows based on user intent and dataset schema without executing arbitrary code."""

    def __init__(self, provider: Optional[LLMProviderAdapter] = None):
        self.provider = provider or LLMProviderAdapter()
        self.sql_generator = TextToSQLGenerator(provider=self.provider)

    def create_plan(
        self,
        question: str,
        columns: List[ColumnDescription],
        permitted_tools: List[str],
    ) -> AgentPlanOutput:
        col_names = [c.name for c in columns]
        numeric_cols = [c.name for c in columns if c.inferred_type == "numeric"]
        cat_cols = [c.name for c in columns if c.inferred_type in ("categorical", "text")]
        date_cols = [c.name for c in columns if c.inferred_type == "datetime" or "date" in c.name.lower()]

        # If LLM is configured, request structured plan
        if self.provider.is_configured:
            prompt = self._build_planner_prompt(question, columns, permitted_tools)
            system_prompt = (
                "You are an AI Business Intelligence query planner. "
                "Select exactly one tool from the permitted tools list and specify valid parameters. "
                "You must never generate or execute executable code directly."
            )
            plan = self.provider.generate_structured_output(
                prompt=prompt,
                schema_class=AgentPlanOutput,
                system_prompt=system_prompt,
            )
            # Validate selected tool
            if plan.selected_tool not in permitted_tools:
                plan.selected_tool = "run_safe_sql"
                plan.warnings.append("Planner selected an invalid tool; reverted to 'run_safe_sql'.")
            
            # If tool is run_safe_sql, ensure safe SQL is generated
            if plan.selected_tool == "run_safe_sql" and not plan.parameters.get("sql"):
                sql, warnings = self.sql_generator.generate_sql(question, columns)
                plan.parameters["sql"] = sql
                plan.warnings.extend(warnings)
            return plan

        # Deterministic heuristic planning
        return self._heuristic_plan(question, columns, permitted_tools, numeric_cols, cat_cols, date_cols)

    def _heuristic_plan(
        self,
        question: str,
        columns: List[ColumnDescription],
        permitted_tools: List[str],
        numeric_cols: List[str],
        cat_cols: List[str],
        date_cols: List[str],
    ) -> AgentPlanOutput:
        q = question.lower()
        warnings: List[str] = []

        # 1. Trends
        if any(w in q for w in ("trend", "over time", "growth", "timeline", "history")) and "detect_trends" in permitted_tools:
            time_col = date_cols[0] if date_cols else (columns[0].name if columns else "date")
            metric_col = numeric_cols[0] if numeric_cols else "revenue"
            for n in numeric_cols:
                if n.lower() in q:
                    metric_col = n
                    break
            return AgentPlanOutput(
                selected_tool="detect_trends",
                parameters={"time_column": time_col, "metric": metric_col},
                rationale=f"Analyzing chronological trend of '{metric_col}' across '{time_col}'.",
                warnings=warnings,
            )

        # 2. Anomalies / Outliers
        if any(w in q for w in ("anomaly", "anomalies", "outlier", "outliers", "unusual", "deviat")) and "detect_anomalies" in permitted_tools:
            features = [n for n in numeric_cols if n.lower() in q] or numeric_cols[:3]
            return AgentPlanOutput(
                selected_tool="detect_anomalies",
                parameters={"feature_columns": features, "contamination": 0.05},
                rationale=f"Detecting statistical outliers in features {features}.",
                warnings=warnings,
            )

        # 3. Grouped breakdown / aggregation
        has_by = "by " in q or "per " in q or "breakdown" in q
        if has_by and "summarize_grouped_metrics" in permitted_tools and cat_cols and numeric_cols:
            matched_dims = [c for c in cat_cols if c.lower() in q] or [cat_cols[0]]
            matched_metrics = [n for n in numeric_cols if n.lower() in q] or [numeric_cols[0]]
            return AgentPlanOutput(
                selected_tool="summarize_grouped_metrics",
                parameters={"dimensions": matched_dims, "metrics": matched_metrics, "aggregation": "sum"},
                rationale=f"Summarizing metrics {matched_metrics} grouped by dimensions {matched_dims}.",
                warnings=warnings,
            )

        # 4. Overall KPIs / Metrics summary
        if any(w in q for w in ("kpi", "summary", "overview", "total", "average", "overall")) and "calculate_kpis" in permitted_tools and numeric_cols:
            matched_metrics = [n for n in numeric_cols if n.lower() in q] or numeric_cols
            return AgentPlanOutput(
                selected_tool="calculate_kpis",
                parameters={"metrics": matched_metrics},
                rationale=f"Calculating summary KPIs for {matched_metrics}.",
                warnings=warnings,
            )

        # 5. Default to Safe SQL analytical query
        sql, sql_warnings = self.sql_generator.generate_sql(question, columns)
        warnings.extend(sql_warnings)
        return AgentPlanOutput(
            selected_tool="run_safe_sql",
            parameters={"sql": sql},
            rationale="Executed analytical SQL query matching specific question criteria.",
            warnings=warnings,
        )

    def _build_planner_prompt(
        self,
        question: str,
        columns: List[ColumnDescription],
        permitted_tools: List[str]
    ) -> str:
        schema_lines = [f"- {c.name} ({c.inferred_type})" for c in columns]
        return (
            f"Dataset Columns:\n" + "\n".join(schema_lines) + "\n\n"
            f"User Question: {question}\n\n"
            f"Permitted Tools: {', '.join(permitted_tools)}\n\n"
            "Select the best tool and fill in valid parameters from the column list."
        )
