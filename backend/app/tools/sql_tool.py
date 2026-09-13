import re
import sqlite3
import time
from typing import Any, Dict, List, Optional, Set, Tuple
import pandas as pd

from backend.app.core.config import settings
from backend.app.core.errors import SecurityError, ValidationError

PROHIBITED_SQL_KEYWORDS = {
    "DROP", "DELETE", "INSERT", "UPDATE", "ALTER", "CREATE", "ATTACH", "DETACH",
    "PRAGMA", "EXEC", "EXECUTE", "TRUNCATE", "REPLACE", "GRANT", "REVOKE",
    "VACUUM", "SHUTDOWN", "INTO", "OUTFILE", "DUMPFILE", "LOAD_FILE", "XP_CMDSHELL"
}

ALLOWED_SQL_FUNCTIONS = {
    "COUNT", "SUM", "AVG", "MIN", "MAX", "ROUND", "COALESCE", "UPPER", "LOWER",
    "STRFTIME", "DATE", "DATETIME", "CAST", "CASE", "WHEN", "THEN", "ELSE", "END",
    "DISTINCT", "AS", "OVER", "ROW_NUMBER", "RANK", "DENSE_RANK", "NTILE", "LAG", "LEAD"
}

SQL_RESERVED_SYNTAX = {
    "SELECT", "FROM", "WHERE", "GROUP", "BY", "HAVING", "ORDER", "ASC", "DESC",
    "LIMIT", "OFFSET", "AND", "OR", "NOT", "IN", "IS", "NULL", "LIKE", "BETWEEN",
    "JOIN", "INNER", "LEFT", "RIGHT", "ON", "UNION", "ALL", "WITH", "AS", "TRUE", "FALSE"
}

class SQLSecurityValidator:
    """Validates and enforces strict analytical safety rules on SQL queries."""

    @classmethod
    def validate_and_sanitize_sql(
        cls,
        sql: str,
        allowed_columns: List[str],
        table_name: str = "dataset"
    ) -> str:
        if not sql or not isinstance(sql, str):
            raise ValidationError("SQL query cannot be empty.")

        clean_sql = sql.strip().strip(";")

        # 1. Reject SQL comments (comment-based injection evasion)
        if "--" in clean_sql or "/*" in clean_sql or "*/" in clean_sql or "#" in clean_sql:
            raise SecurityError("SQL comments are prohibited.")

        # 2. Reject multi-statement queries (semicolon followed by another statement)
        if ";" in clean_sql:
            raise SecurityError("Multiple SQL statements in a single execution are prohibited.")

        # 3. Whitelist start: must begin with SELECT or WITH
        first_token = clean_sql.split()[0].upper()
        if first_token not in ("SELECT", "WITH"):
            raise SecurityError(f"Prohibited statement type: '{first_token}'. Only SELECT analytical queries are allowed.")

        # 4. Check for destructive/prohibited keywords using regex word boundary
        upper_sql = clean_sql.upper()
        for keyword in PROHIBITED_SQL_KEYWORDS:
            if re.search(rf"\b{re.escape(keyword)}\b", upper_sql):
                raise SecurityError(f"Prohibited SQL keyword detected: '{keyword}'.")

        # 5. Table validation: verify that EVERY queried table is the designated dataset table
        cte_names = set()
        with_match = re.match(r"^\s*WITH\s+([a-zA-Z0-9_]+)\s+AS", clean_sql, re.IGNORECASE)
        if with_match:
            cte_names.add(with_match.group(1).lower())

        allowed_tables = {table_name.lower()} | cte_names

        from_tables = re.findall(r"\bFROM\s+([a-zA-Z0-9_]+)", clean_sql, re.IGNORECASE)
        join_tables = re.findall(r"\bJOIN\s+([a-zA-Z0-9_]+)", clean_sql, re.IGNORECASE)
        
        all_queried_tables = [t.lower() for t in (from_tables + join_tables)]
        if not all_queried_tables:
            raise SecurityError(f"Query must reference the dataset table '{table_name}'.")

        for tbl in all_queried_tables:
            if tbl not in allowed_tables:
                raise SecurityError(f"Unauthorized table reference: '{tbl}'. Only '{table_name}' can be queried.")

        # 6. Column & identifier validation: reject unknown identifiers
        allowed_names_lower = {c.lower() for c in allowed_columns}
        cls._validate_identifiers(clean_sql, allowed_names_lower, table_name.lower(), cte_names)

        # 7. Enforce LIMIT
        sanitized_sql = cls._enforce_limit(clean_sql)
        return sanitized_sql

    @classmethod
    def _validate_identifiers(cls, sql: str, allowed_columns: Set[str], table_name: str, cte_names: Set[str]):
        """
        Tokenize identifiers and ensure no arbitrary system variables, injected columns, or functions.
        """
        tokens = set(re.findall(r"\b[a-zA-Z_][a-zA-Z0-9_]*\b", sql))

        # Reserved terms, analytical functions, aliases, and dataset columns
        exempt = (
            {t.lower() for t in PROHIBITED_SQL_KEYWORDS} |
            {t.lower() for t in ALLOWED_SQL_FUNCTIONS} |
            {t.lower() for t in SQL_RESERVED_SYNTAX} |
            allowed_columns |
            {table_name, "d", "t", "t1", "t2", "total", "val", "subq"} |
            cte_names
        )

        # In case query defines aliases (e.g. AS total_rev or GROUP BY region, etc.)
        as_aliases = set(m.lower() for m in re.findall(r"\bAS\s+([a-zA-Z0-9_]+)\b", sql, re.IGNORECASE))
        exempt.update(as_aliases)

        # Known column suffixes or variations (e.g. year, month, day)
        date_parts = {"year", "month", "day", "hour", "quarter"}
        exempt.update(date_parts)

        unknown_tokens = [
            t for t in tokens
            if t.lower() not in exempt and not t.isdigit()
        ]

        if unknown_tokens:
            raise SecurityError(
                f"Unknown or unauthorized identifier detected: '{unknown_tokens[0]}'. "
                f"Only verified dataset columns and safe analytical functions are permitted."
            )

    @classmethod
    def _enforce_limit(cls, sql: str) -> str:
        """Ensure a LIMIT clause exists and is clamped to MAX_SQL_ROW_LIMIT."""
        limit_match = re.search(r"\bLIMIT\s+(\d+)\b", sql, re.IGNORECASE)
        if limit_match:
            requested_limit = int(limit_match.group(1))
            if requested_limit > settings.MAX_SQL_ROW_LIMIT:
                sql = re.sub(r"\bLIMIT\s+\d+\b", f"LIMIT {settings.MAX_SQL_ROW_LIMIT}", sql, flags=re.IGNORECASE)
        else:
            sql = f"{sql} LIMIT {settings.DEFAULT_SQL_ROW_LIMIT}"
        return sql


class SafeSQLExecutor:
    """Executes safe, verified SQL queries against a Pandas DataFrame via in-memory SQLite."""

    @classmethod
    def execute(
        cls,
        df: pd.DataFrame,
        sql: str,
        allowed_columns: Optional[List[str]] = None,
        table_name: str = "dataset"
    ) -> Tuple[List[Dict[str, Any]], float, str]:
        cols = allowed_columns or [str(c) for c in df.columns]
        
        # 1. Validate SQL
        validated_sql = SQLSecurityValidator.validate_and_sanitize_sql(
            sql=sql,
            allowed_columns=cols,
            table_name=table_name,
        )

        # 2. Execute against in-memory SQLite
        start_time = time.time()
        conn = sqlite3.connect(":memory:")
        try:
            # Load dataframe into SQLite
            df.to_sql(table_name, conn, index=False, if_exists="replace")
            
            # Restrict SQLite connection
            conn.set_authorizer(cls._sqlite_authorizer)

            cursor = conn.cursor()
            cursor.execute(validated_sql)
            
            columns = [col[0] for col in cursor.description] if cursor.description else []
            rows = cursor.fetchall()
            
            latency_ms = round((time.time() - start_time) * 1000.0, 2)
            results = [dict(zip(columns, row)) for row in rows]
            return results, latency_ms, validated_sql
        finally:
            conn.close()

    @staticmethod
    def _sqlite_authorizer(action: int, arg1: Any, arg2: Any, db_name: Any, trigger_name: Any) -> int:
        """
        SQLite authorizer hook:
        Only allows SQLITE_SELECT, SQLITE_READ, and reading column data.
        Blocks ATTACH, DETACH, PRAGMA, FUNCTION execution if external, etc.
        """
        # SQLITE_OK = 0, SQLITE_DENY = 1, SQLITE_IGNORE = 2
        # Action codes:
        # SQLITE_SELECT = 21, SQLITE_READ = 20, SQLITE_FUNCTION = 31
        allowed_actions = {21, 20, 31}  # SELECT, READ, FUNCTION
        if action in allowed_actions:
            return sqlite3.SQLITE_OK
        # Disallow everything else
        return sqlite3.SQLITE_DENY
