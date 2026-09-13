"""
Pytest configuration and shared test fixtures for Developer 1 (Data & ML).
"""

import os
from pathlib import Path
import pytest
import pandas as pd
import numpy as np


@pytest.fixture
def fixtures_dir() -> Path:
    return Path(__file__).parent.parent.parent / "data" / "fixtures"


@pytest.fixture
def synthetic_csv_path(fixtures_dir) -> Path:
    return fixtures_dir / "synthetic_business_data.csv"


@pytest.fixture
def sample_business_df() -> pd.DataFrame:
    """A small hand-checked DataFrame for deterministic unit tests."""
    data = {
        "order_id": ["ORD-1", "ORD-2", "ORD-3", "ORD-4", "ORD-5", "ORD-6"],
        "order_date": ["2023-01-10", "2023-01-20", "2023-02-15", "2023-02-25", "2023-03-05", "2023-03-25"],
        "region": ["North", "North", "South", "South", "East", "East"],
        "product": ["Widget A", "Widget B", "Widget A", "Widget B", "Widget A", "Widget B"],
        "units": [10, 5, 20, 15, 12, 8],
        "revenue": [1000.0, 500.0, 2000.0, 1500.0, 1200.0, 800.0],
        "cost": [600.0, 300.0, 1200.0, 900.0, 720.0, 480.0],
        "profit": [400.0, 200.0, 800.0, 600.0, 480.0, 320.0],
    }
    return pd.DataFrame(data)
