import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, JSON, Text, ForeignKey
from backend.app.db.session import Base

class AnalysisHistoryModel(Base):
    __tablename__ = "analysis_history"

    result_id = Column(String(36), primary_key=True, index=True)
    dataset_id = Column(String(36), ForeignKey("datasets.dataset_id"), nullable=False, index=True)
    question = Column(Text, nullable=False)
    tool = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False)  # success, failed, rejected
    reason = Column(Text, nullable=False)        # concise user-safe explanation
    latency_ms = Column(Float, nullable=False, default=0.0)
    chart_spec = Column(JSON, nullable=False, default=dict)
    insights = Column(JSON, nullable=False, default=list)
    warnings = Column(JSON, nullable=False, default=list)
    result_data = Column(JSON, nullable=True)     # summarized result data for reference
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
