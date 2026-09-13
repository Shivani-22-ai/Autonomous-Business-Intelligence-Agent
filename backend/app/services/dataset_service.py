import uuid
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.core.errors import NotFoundError, SecurityError, ValidationError
from backend.app.core.security import sanitize_filename, sanitize_path, validate_dataset_id
from backend.app.models.dataset import DatasetModel
from backend.app.schemas.dataset import ColumnDescription, DatasetMetadata, QualitySummary

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".json"}

class DatasetService:
    def __init__(self, db: Session):
        self.db = db

    def list_datasets(self) -> List[DatasetMetadata]:
        records = self.db.query(DatasetModel).order_by(DatasetModel.created_at.desc()).all()
        return [self._to_schema(r) for r in records]

    def get_dataset(self, dataset_id: str) -> DatasetModel:
        clean_id = validate_dataset_id(dataset_id)
        record = self.db.query(DatasetModel).filter(DatasetModel.dataset_id == clean_id).first()
        if not record:
            raise NotFoundError(f"Dataset with ID '{clean_id}' not found.")
        return record

    def get_dataset_metadata(self, dataset_id: str) -> DatasetMetadata:
        record = self.get_dataset(dataset_id)
        return self._to_schema(record)

    def load_dataframe(self, dataset_id: str) -> pd.DataFrame:
        """Safely load dataframe for analytical tasks."""
        record = self.get_dataset(dataset_id)
        file_path = sanitize_path(settings.DATA_DIR, record.file_path)
        if not file_path.exists():
            raise NotFoundError(f"Underlying data file for dataset '{dataset_id}' is missing.")
        
        ext = file_path.suffix.lower()
        if ext == ".csv":
            return pd.read_csv(file_path)
        elif ext in (".xlsx", ".xls"):
            return pd.read_excel(file_path)
        elif ext == ".json":
            return pd.read_json(file_path)
        else:
            raise ValidationError(f"Unsupported file format: {ext}")

    def save_and_profile_file(self, filename: str, content_bytes: bytes) -> DatasetMetadata:
        """Save an uploaded file, compute schema & quality summary, and register in database."""
        clean_filename = sanitize_filename(filename)
        ext = Path(clean_filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise ValidationError(f"Invalid file extension '{ext}'. Allowed extensions: {', '.join(ALLOWED_EXTENSIONS)}")

        if len(content_bytes) > settings.MAX_UPLOAD_SIZE_BYTES:
            raise ValidationError(f"File size exceeds maximum allowed limit of {settings.MAX_UPLOAD_SIZE_BYTES // (1024*1024)} MB")

        dataset_id = str(uuid.uuid4())
        destination_filename = f"{dataset_id}_{clean_filename}"
        destination_path = sanitize_path(settings.UPLOADS_DIR, destination_filename)

        with open(destination_path, "wb") as f:
            f.write(content_bytes)

        # Parse with pandas
        try:
            if ext == ".csv":
                df = pd.read_csv(destination_path)
            elif ext in (".xlsx", ".xls"):
                df = pd.read_excel(destination_path)
            elif ext == ".json":
                df = pd.read_json(destination_path)
            else:
                raise ValidationError("Unsupported format")
        except Exception as e:
            if destination_path.exists():
                destination_path.unlink()
            raise ValidationError(f"Failed to parse file: {str(e)}")

        schema_cols, quality = self._profile_dataframe(df)

        # Store relative file path inside data directory
        rel_path = destination_path.relative_to(settings.DATA_DIR)

        model = DatasetModel(
            dataset_id=dataset_id,
            filename=clean_filename,
            file_type=ext.lstrip("."),
            file_path=str(rel_path),
            row_count=len(df),
            column_count=len(df.columns),
            schema_json=[c.model_dump() for c in schema_cols],
            quality_summary=quality.model_dump(),
        )

        self.db.add(model)
        self.db.commit()
        self.db.refresh(model)

        return self._to_schema(model)

    def register_existing_file(self, file_path: Path, filename: Optional[str] = None) -> DatasetMetadata:
        """Register a fixture or pre-existing dataset file."""
        safe_path = sanitize_path(settings.DATA_DIR, file_path)
        if not safe_path.exists():
            raise NotFoundError(f"File '{file_path}' does not exist.")
        
        with open(safe_path, "rb") as f:
            content = f.read()
        return self.save_and_profile_file(filename or safe_path.name, content)

    def _profile_dataframe(self, df: pd.DataFrame) -> Tuple[List[ColumnDescription], QualitySummary]:
        columns: List[ColumnDescription] = []
        total_cells = df.size
        missing_cells = int(df.isna().sum().sum())
        missing_pct = round((missing_cells / total_cells * 100.0) if total_cells > 0 else 0.0, 2)
        duplicate_rows = int(df.duplicated().sum())

        issues = []
        if missing_pct > 10.0:
            issues.append(f"High percentage of missing values ({missing_pct}%)")
        if duplicate_rows > 0:
            issues.append(f"Detected {duplicate_rows} duplicate rows")

        for col in df.columns:
            series = df[col]
            inferred = self._infer_col_type(series)
            nullable = bool(series.isna().any())
            unique_count = int(series.nunique(dropna=True))

            # Grab up to 3 non-null safe sample values
            non_null_samples = series.dropna().unique()[:3]
            sample_values = [self._json_safe_val(v) for v in non_null_samples]

            columns.append(
                ColumnDescription(
                    name=str(col),
                    inferred_type=inferred,
                    nullable=nullable,
                    unique_count=unique_count,
                    sample_values=sample_values,
                )
            )

        # Quality score formula (100 base, penalize missing % and duplicates)
        quality_score = max(0.0, round(100.0 - (missing_pct * 0.5) - (min(duplicate_rows / max(len(df), 1), 0.5) * 50.0), 2))

        quality = QualitySummary(
            missing_cells_percentage=missing_pct,
            duplicate_rows_count=duplicate_rows,
            total_cells=total_cells,
            quality_score=quality_score,
            issues=issues,
        )

        return columns, quality

    def _infer_col_type(self, series: pd.Series) -> str:
        if pd.api.types.is_numeric_dtype(series):
            return "numeric"
        if pd.api.types.is_datetime64_any_dtype(series):
            return "datetime"
        if pd.api.types.is_bool_dtype(series):
            return "boolean"
        # Try datetime conversion check if string
        if series.dropna().count() > 0:
            first_val = str(series.dropna().iloc[0])
            if any(date_hint in first_val for date_hint in ["-", "/", ":"]) and len(first_val) >= 8:
                try:
                    pd.to_datetime(series.dropna().head(10))
                    return "datetime"
                except Exception:
                    pass
            if series.nunique() < 20 or (len(series) > 0 and series.nunique() / len(series) < 0.2):
                return "categorical"
        return "text"

    def _json_safe_val(self, val: Any) -> Any:
        if pd.isna(val):
            return None
        if isinstance(val, (np.integer, int)):
            return int(val)
        if isinstance(val, (np.floating, float)):
            return float(val) if not np.isnan(val) else None
        if isinstance(val, (pd.Timestamp, np.datetime64)):
            return str(val)
        return str(val)

    def _to_schema(self, model: DatasetModel) -> DatasetMetadata:
        cols = [ColumnDescription(**c) for c in (model.schema_json or [])]
        quality = QualitySummary(**(model.quality_summary or {}))
        return DatasetMetadata(
            dataset_id=model.dataset_id,
            filename=model.filename,
            file_type=model.file_type,
            row_count=model.row_count,
            column_count=model.column_count,
            schema=cols,
            quality_summary=quality,
            created_at=model.created_at,
        )
