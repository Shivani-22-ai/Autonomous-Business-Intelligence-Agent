import datetime
from sqlalchemy import Column, String, Integer, DateTime, JSON, Text
from backend.app.db.session import Base

class DatasetModel(Base):
    __tablename__ = "datasets"

    dataset_id = Column(String(36), primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(20), nullable=False)
    file_path = Column(String(512), nullable=False)  # Internal server path, hidden from client
    row_count = Column(Integer, nullable=False, default=0)
    column_count = Column(Integer, nullable=False, default=0)
    schema_json = Column(JSON, nullable=False, default=list)  # List of ColumnDescription
    quality_summary = Column(JSON, nullable=False, default=dict)  # Quality metrics
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
