"""
Dataset loader and validator.
Handles CSV and Excel ingestion, data structure validation, identifier sanitization, and dataset ID assignment.
"""

import os
import re
import uuid
import io
from pathlib import Path
from typing import BinaryIO, Optional, Tuple, Union
import pandas as pd

from backend.app.schemas.dataset import DatasetMetadata


class DatasetLoadError(Exception):
    """Base exception for dataset ingestion errors."""
    pass


class InvalidFileExtensionError(DatasetLoadError):
    """Raised when an unsupported file type is provided."""
    pass


class EmptyDatasetError(DatasetLoadError):
    """Raised when the uploaded dataset has 0 rows or 0 columns."""
    pass


class MalformedDatasetError(DatasetLoadError):
    """Raised when dataset cannot be parsed or lacks readable structure."""
    pass


class DatasetLoader:
    """
    Robust loader and validator for tabular business datasets (CSV, XLSX, XLS).
    """

    ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls"}
    MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB

    @staticmethod
    def sanitize_column_name(col_name: str, index: int) -> str:
        """
        Sanitize a column name into a clean, safe identifier.
        """
        if col_name is None or pd.isna(col_name):
            return f"unnamed_col_{index}"
        
        cleaned = str(col_name).strip()
        if not cleaned:
            return f"unnamed_col_{index}"
        
        # Replace spaces, dashes, dots, and separators with underscores
        cleaned = re.sub(r"[\s\.\-]+", "_", cleaned)
        cleaned = re.sub(r"[^\w]", "", cleaned)
        cleaned = re.sub(r"_+", "_", cleaned).strip("_")
        cleaned = cleaned.lower()
        
        # Ensure it doesn't start with a digit
        if cleaned and cleaned[0].isdigit():
            cleaned = f"col_{cleaned}"
            
        return cleaned or f"col_{index}"

    @classmethod
    def deduplicate_columns(cls, columns: list) -> list:
        """
        Ensure all column names are unique by appending suffixes to duplicates.
        """
        seen = {}
        unique_cols = []
        for i, col in enumerate(columns):
            sanitized = cls.sanitize_column_name(col, i)
            if sanitized in seen:
                seen[sanitized] += 1
                unique_cols.append(f"{sanitized}_{seen[sanitized]}")
            else:
                seen[sanitized] = 0
                unique_cols.append(sanitized)
        return unique_cols

    @classmethod
    def load_from_file(
        cls,
        file_input: Union[str, Path, bytes, BinaryIO, io.BytesIO],
        filename: str,
        dataset_id: Optional[str] = None,
    ) -> Tuple[pd.DataFrame, DatasetMetadata]:
        """
        Load, validate, sanitize, and metadata-tag an uploaded dataset.

        Args:
            file_input: File path, bytes, or file-like object.
            filename: Original file name (e.g., 'sales_data.csv').
            dataset_id: Optional UUID string. If None, a new UUID is generated.

        Returns:
            Tuple of (sanitized_dataframe, dataset_metadata)
        """
        if not filename:
            raise DatasetLoadError("Filename must be provided.")

        ext = Path(filename).suffix.lower()
        if ext not in cls.ALLOWED_EXTENSIONS:
            raise InvalidFileExtensionError(
                f"Unsupported file format '{ext}'. Allowed formats: {', '.join(cls.ALLOWED_EXTENSIONS)}"
            )

        assigned_id = dataset_id or str(uuid.uuid4())

        # Check size if input is a path or bytes
        if isinstance(file_input, (str, Path)):
            if not os.path.exists(file_input):
                raise DatasetLoadError(f"File not found: {file_input}")
            if os.path.getsize(file_input) == 0:
                raise EmptyDatasetError(f"File '{filename}' is empty (0 bytes).")
            if os.path.getsize(file_input) > cls.MAX_FILE_SIZE_BYTES:
                raise DatasetLoadError(
                    f"File size exceeds maximum permitted limit of {cls.MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB."
                )
        elif isinstance(file_input, bytes):
            if len(file_input) == 0:
                raise EmptyDatasetError(f"Dataset '{filename}' is empty (0 bytes).")
            if len(file_input) > cls.MAX_FILE_SIZE_BYTES:
                raise DatasetLoadError(
                    f"File size exceeds maximum permitted limit of {cls.MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB."
                )

        try:
            if ext == ".csv":
                if isinstance(file_input, bytes):
                    df = pd.read_csv(io.BytesIO(file_input))
                elif isinstance(file_input, (str, Path)):
                    df = pd.read_csv(file_input)
                else:
                    df = pd.read_csv(file_input)
            elif ext in {".xlsx", ".xls"}:
                if isinstance(file_input, bytes):
                    df = pd.read_excel(io.BytesIO(file_input))
                elif isinstance(file_input, (str, Path)):
                    df = pd.read_excel(file_input)
                else:
                    df = pd.read_excel(file_input)
            else:
                raise InvalidFileExtensionError(f"Unsupported extension: {ext}")
        except EmptyDatasetError:
            raise
        except Exception as e:
            if "EmptyDataError" in type(e).__name__ or "No columns to parse" in str(e):
                raise EmptyDatasetError(f"Dataset '{filename}' contains no parseable data.")
            raise MalformedDatasetError(f"Failed to parse dataset '{filename}': {str(e)}") from e

        if df.empty or len(df) == 0:
            raise EmptyDatasetError(f"Dataset '{filename}' contains 0 rows.")

        if len(df.columns) == 0:
            raise EmptyDatasetError(f"Dataset '{filename}' contains 0 columns.")

        # Sanitize and deduplicate column names
        df.columns = cls.deduplicate_columns(list(df.columns))

        # Build metadata
        metadata = DatasetMetadata(
            dataset_id=assigned_id,
            filename=filename,
            file_type=ext.lstrip(".").lower(),
            row_count=len(df),
            column_count=len(df.columns),
        )

        return df, metadata
