import re
from typing import Dict, List, Optional, Tuple
from backend.app.agents.provider import LLMProviderAdapter
from backend.app.core.errors import SecurityError, ValidationError
from backend.app.schemas.dataset import ColumnDescription
from backend.app.tools.sql_tool import SQLSecurityValidator

class TextToSQLGenerator:
    """Translates natural language questions to safe, validated analytical SQL."""

    def __init__(self, provider: Optional[LLMProviderAdapter] = None):
        self.provider = provider or LLMProviderAdapter()

    def generate_sql(
        self,
        question: str,
        columns: List[ColumnDescription],
        table_name: str = "dataset",
        max_repair_attempts: int = 2,
    ) -> Tuple[str, List[str]]:
        """
        Generate and validate analytical SQL from user question.
        Returns: (validated_sql, warnings)
        """
        col_names = [c.name for c in columns]
        warnings: List[str] = []

        # Formulate prompt for LLM or heuristic
        prompt = self._build_sql_prompt(question, columns, table_name)
        system_prompt = (
            "You are a safe analytical SQL generator. You only generate single-statement SELECT queries "
            f"for the table '{table_name}'. Never use comments, destructive commands, or multiple statements."
        )

        raw_sql = ""
        if self.provider.is_configured:
            raw_sql = self.provider.generate_completion(prompt, system_prompt=system_prompt)
        else:
            raw_sql = self._heuristic_sql_generation(question, columns, table_name)

        clean_sql = self._clean_sql(raw_sql)

        # Validate with bounded repair
        current_sql = clean_sql
        for attempt in range(max_repair_attempts + 1):
            try:
                validated_sql = SQLSecurityValidator.validate_and_sanitize_sql(
                    sql=current_sql,
                    allowed_columns=col_names,
                    table_name=table_name,
                )
                return validated_sql, warnings
            except (SecurityError, ValidationError) as e:
                warnings.append(f"SQL validation attempt {attempt + 1} warning: {str(e)}")
                if attempt < max_repair_attempts:
                    # Attempt deterministic repair
                    current_sql = self._repair_sql(current_sql, question, col_names, table_name)
                else:
                    # Final attempt failed
                    raise SecurityError(f"Generated SQL failed safety validation: {str(e)}")

        raise SecurityError("Unable to produce safe analytical SQL.")

    def _build_sql_prompt(self, question: str, columns: List[ColumnDescription], table_name: str) -> str:
        col_desc_lines = [f"- {c.name} ({c.inferred_type}, nullable={c.nullable})" for c in columns]
        col_text = "\n".join(col_desc_lines)
        return (
            f"Generate a single SQLite-compatible SELECT statement for table '{table_name}'.\n"
            f"Schema:\n{col_text}\n\n"
            f"User Question: {question}\n\n"
            f"Requirements:\n"
            f"1. Analytical SELECT only (SUM, AVG, COUNT, GROUP BY, ORDER BY, etc.)\n"
            f"2. Use only columns present in the schema above\n"
            f"3. No comments (-- or /* */), no semicolons, no nested semicolons\n"
            f"4. Return ONLY the raw SQL statement, no markdown explanation."
        )

    def _clean_sql(self, text: str) -> str:
        sql = text.strip()
        if sql.startswith("```sql"):
            sql = sql[6:]
        if sql.startswith("```"):
            sql = sql[3:]
        if sql.endswith("```"):
            sql = sql[:-3]
        return sql.strip().strip(";")

    def _repair_sql(self, sql: str, question: str, allowed_columns: List[str], table_name: str) -> str:
        """Strip prohibited characters or fallback to guaranteed safe query."""
        # Strip comments
        sql = re.sub(r"--.*", "", sql)
        sql = re.sub(r"/\*.*?\*/", "", sql, flags=re.DOTALL)
        # Strip semicolons
        sql = sql.replace(";", "")
        
        # If still invalid or empty, fallback to robust heuristic
        if not sql.strip().upper().startswith("SELECT"):
            return self._heuristic_sql_generation(question, [ColumnDescription(name=c, inferred_type="text", nullable=True, unique_count=0) for c in allowed_columns], table_name)
        return sql.strip()

    def _heuristic_sql_generation(self, question: str, columns: List[ColumnDescription], table_name: str) -> str:
        """Deterministic analytical query builder based on question semantics."""
        q = question.lower()
        col_names = [c.name for c in columns]
        
        # Identify numeric columns and categorical/date columns
        numeric_cols = [c.name for c in columns if c.inferred_type == "numeric"]
        cat_cols = [c.name for c in columns if c.inferred_type in ("categorical", "text")]
        date_cols = [c.name for c in columns if c.inferred_type == "datetime" or "date" in c.name.lower()]

        # Pick primary metric
        metric = numeric_cols[0] if numeric_cols else "*"
        for n in numeric_cols:
            if n.lower() in q:
                metric = n
                break

        # Pick primary dimension
        dimension = None
        for c in cat_cols:
            if c.lower() in q or f"by {c.lower()}" in q:
                dimension = c
                break

        # Pick date dimension if time requested
        if ("trend" in q or "over time" in q or "daily" in q or "monthly" in q) and date_cols:
            date_col = date_cols[0]
            if metric != "*":
                return f"SELECT {date_col}, SUM({metric}) AS total_{metric} FROM {table_name} GROUP BY {date_col} ORDER BY {date_col} ASC LIMIT 50"
            return f"SELECT {date_col}, COUNT(*) AS count FROM {table_name} GROUP BY {date_col} ORDER BY {date_col} ASC LIMIT 50"

        if dimension and metric != "*":
            return f"SELECT {dimension}, SUM({metric}) AS total_{metric} FROM {table_name} GROUP BY {dimension} ORDER BY total_{metric} DESC LIMIT 20"
        elif dimension:
            return f"SELECT {dimension}, COUNT(*) AS record_count FROM {table_name} GROUP BY {dimension} ORDER BY record_count DESC LIMIT 20"
        elif metric != "*":
            return f"SELECT SUM({metric}) AS total_{metric}, AVG({metric}) AS avg_{metric}, MIN({metric}) AS min_{metric}, MAX({metric}) AS max_{metric} FROM {table_name}"
        else:
            return f"SELECT * FROM {table_name} LIMIT 10"
