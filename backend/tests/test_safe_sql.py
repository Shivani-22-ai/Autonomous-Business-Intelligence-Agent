import pandas as pd
import pytest

from backend.app.agents.text_to_sql import TextToSQLGenerator
from backend.app.core.errors import SecurityError, ValidationError
from backend.app.schemas.dataset import ColumnDescription
from backend.app.tools.sql_tool import SafeSQLExecutor, SQLSecurityValidator

@pytest.fixture
def sales_df():
    data = {
        "region": ["North", "South", "East", "West", "North", "South"],
        "revenue": [1200.0, 450.0, 890.0, 1550.0, 620.0, 2100.0],
        "units": [10, 5, 8, 15, 6, 20],
        "category": ["A", "B", "A", "B", "A", "B"],
    }
    return pd.DataFrame(data)

def test_safe_sql_execution(sales_df):
    sql = "SELECT region, SUM(revenue) AS total_rev FROM dataset GROUP BY region ORDER BY total_rev DESC"
    results, latency, validated_sql = SafeSQLExecutor.execute(sales_df, sql)
    
    assert len(results) == 4
    assert latency >= 0.0
    assert "LIMIT" in validated_sql
    assert results[0]["region"] == "South"
    assert results[0]["total_rev"] == 2550.0

def test_limit_enforcement(sales_df):
    sql = "SELECT region FROM dataset"
    validated = SQLSecurityValidator.validate_and_sanitize_sql(sql, allowed_columns=["region"])
    assert "LIMIT 100" in validated

    sql_excessive = "SELECT region FROM dataset LIMIT 50000"
    validated_excessive = SQLSecurityValidator.validate_and_sanitize_sql(sql_excessive, allowed_columns=["region"])
    assert "LIMIT 1000" in validated_excessive

def test_reject_destructive_drop(sales_df):
    malicious_queries = [
        "DROP TABLE dataset",
        "SELECT * FROM dataset; DROP TABLE dataset",
        "ALTER TABLE dataset ADD COLUMN hacked TEXT",
        "DELETE FROM dataset WHERE 1=1",
        "INSERT INTO dataset VALUES ('hack', 0, 0, 'X')",
        "UPDATE dataset SET revenue = 0",
        "PRAGMA table_info(dataset)",
        "SELECT * FROM sqlite_master",
    ]
    cols = list(sales_df.columns)
    for q in malicious_queries:
        with pytest.raises(SecurityError):
            SQLSecurityValidator.validate_and_sanitize_sql(q, allowed_columns=cols)

def test_reject_sql_comments():
    malicious = "SELECT region FROM dataset -- bypass comment"
    with pytest.raises(SecurityError):
        SQLSecurityValidator.validate_and_sanitize_sql(malicious, allowed_columns=["region"])

def test_reject_multi_statements():
    malicious = "SELECT region FROM dataset; SELECT units FROM dataset"
    with pytest.raises(SecurityError):
        SQLSecurityValidator.validate_and_sanitize_sql(malicious, allowed_columns=["region", "units"])

def test_text_to_sql_generator():
    generator = TextToSQLGenerator()
    columns = [
        ColumnDescription(name="region", inferred_type="categorical", nullable=False, unique_count=4),
        ColumnDescription(name="revenue", inferred_type="numeric", nullable=False, unique_count=6),
        ColumnDescription(name="units", inferred_type="numeric", nullable=False, unique_count=6),
    ]
    sql, warnings = generator.generate_sql("Show me total revenue by region", columns)
    assert "SELECT" in sql
    assert "revenue" in sql
    assert "region" in sql
    assert "FROM dataset" in sql
    assert "LIMIT" in sql
