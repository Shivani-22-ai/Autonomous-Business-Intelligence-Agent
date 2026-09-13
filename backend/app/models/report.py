import datetime
from sqlalchemy import Column, String, DateTime, JSON, Text, ForeignKey
from backend.app.db.session import Base

class ReportModel(Base):
    __tablename__ = "reports"

    report_id = Column(String(36), primary_key=True, index=True)
    dataset_id = Column(String(36), ForeignKey("datasets.dataset_id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    summary = Column(Text, nullable=False)
    sections = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
