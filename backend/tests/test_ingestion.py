"""
Unit tests for dataset ingestion and validation (DATA-01 and DATA-02 acceptance checks).
"""

import io
import pytest
import pandas as pd

from backend.app.ingestion.dataset_loader import (
    DatasetLoader,
    DatasetLoadError,
    EmptyDatasetError,
    InvalidFileExtensionError,
    MalformedDatasetError,
)


def test_load_valid_csv(synthetic_csv_path):
    df, meta = DatasetLoader.load_from_file(synthetic_csv_path, filename="synthetic_business_data.csv")
    assert df is not None
    assert len(df) == 250
    assert meta.row_count == 250
    assert meta.column_count == 9
    assert meta.file_type == "csv"
    assert meta.dataset_id is not None
    assert "order_id" in df.columns
    assert "revenue" in df.columns


def test_load_from_bytes():
    csv_content = b"region,sales,profit\nNorth,1000,200\nSouth,2000,400\n"
    df, meta = DatasetLoader.load_from_file(csv_content, filename="sales.csv")
    assert len(df) == 2
    assert list(df.columns) == ["region", "sales", "profit"]
    assert meta.row_count == 2


def test_load_valid_excel(tmp_path):
    excel_path = tmp_path / "test_data.xlsx"
    test_df = pd.DataFrame({"product": ["A", "B"], "price": [10.5, 20.0]})
    test_df.to_excel(excel_path, index=False)

    df, meta = DatasetLoader.load_from_file(excel_path, filename="test_data.xlsx")
    assert len(df) == 2
    assert meta.file_type == "xlsx"
    assert "product" in df.columns
    assert "price" in df.columns


def test_reject_unsupported_extension():
    with pytest.raises(InvalidFileExtensionError) as exc_info:
        DatasetLoader.load_from_file(b"some content", filename="report.pdf")
    assert "Unsupported file format '.pdf'" in str(exc_info.value)


def test_reject_empty_file(tmp_path):
    empty_file = tmp_path / "empty.csv"
    empty_file.write_text("")
    with pytest.raises(EmptyDatasetError):
        DatasetLoader.load_from_file(empty_file, filename="empty.csv")


def test_reject_empty_bytes():
    with pytest.raises(EmptyDatasetError):
        DatasetLoader.load_from_file(b"", filename="empty.csv")


def test_reject_header_only_csv():
    header_only = b"col1,col2,col3\n"
    with pytest.raises(EmptyDatasetError):
        DatasetLoader.load_from_file(header_only, filename="header_only.csv")


def test_column_sanitization_and_deduplication():
    # Columns with spaces, special chars, leading digits, and duplicate names
    csv_data = b"Order ID,Order ID,1st Month Profit,Total  Sales ($),Region#\n1,1,100,500,North\n"
    df, meta = DatasetLoader.load_from_file(csv_data, filename="messy.csv")
    cols = list(df.columns)
    
    # Should have deduplicated and sanitized names
    assert cols[0] == "order_id"
    assert cols[1] == "order_id_1"
    assert cols[2] == "col_1st_month_profit"
    assert cols[3] == "total_sales"
    assert cols[4] == "region"


def test_custom_dataset_id_preserved():
    custom_id = "12345678-1234-5678-1234-567812345678"
    csv_data = b"col_a,col_b\n1,2\n"
    df, meta = DatasetLoader.load_from_file(csv_data, filename="data.csv", dataset_id=custom_id)
    assert meta.dataset_id == custom_id
