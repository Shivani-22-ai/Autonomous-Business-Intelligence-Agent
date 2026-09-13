import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from backend.app.core.security import validate_dataset_id
from backend.app.models.analysis import AnalysisHistoryModel
from backend.app.schemas.analysis import AnalysisHistoryItem

class HistoryService:
    def __init__(self, db: Session):
        self.db = db

    def record_analysis(
        self,
        dataset_id: str,
        question: str,
        tool: str,
        status: str,
        reason: str,
        latency_ms: float,
        chart_spec: Dict[str, Any],
        insights: List[str],
        warnings: List[str],
        result_data: Optional[List[Dict[str, Any]]] = None,
    ) -> AnalysisHistoryItem:
        result_id = str(uuid.uuid4())
        record = AnalysisHistoryModel(
            result_id=result_id,
            dataset_id=dataset_id,
            question=question,
            tool=tool,
            status=status,
            reason=reason,
            latency_ms=latency_ms,
            chart_spec=chart_spec,
            insights=insights,
            warnings=warnings,
            result_data=result_data,
        )
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return self._to_schema(record)

    def get_history(self, dataset_id: Optional[str] = None, limit: int = 50) -> List[AnalysisHistoryItem]:
        query = self.db.query(AnalysisHistoryModel)
        if dataset_id:
            clean_id = validate_dataset_id(dataset_id)
            query = query.filter(AnalysisHistoryModel.dataset_id == clean_id)
        records = query.order_by(AnalysisHistoryModel.created_at.desc()).limit(limit).all()
        return [self._to_schema(r) for r in records]

    def get_result_by_id(self, result_id: str) -> Optional[AnalysisHistoryItem]:
        record = self.db.query(AnalysisHistoryModel).filter(AnalysisHistoryModel.result_id == result_id).first()
        return self._to_schema(record) if record else None

    def _to_schema(self, r: AnalysisHistoryModel) -> AnalysisHistoryItem:
        return AnalysisHistoryItem(
            result_id=r.result_id,
            dataset_id=r.dataset_id,
            question=r.question,
            tool=r.tool,
            status=r.status,
            reason=r.reason,
            latency_ms=r.latency_ms,
            chart_spec=r.chart_spec or {},
            insights=r.insights or [],
            warnings=r.warnings or [],
            created_at=r.created_at,
        )
