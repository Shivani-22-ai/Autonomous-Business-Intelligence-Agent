from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from backend.app.core.errors import NotFoundError
from backend.app.db.session import get_db
from backend.app.schemas.analysis import (
    AnalysisHistoryItem,
    AnalysisHistoryResponse,
    AnalysisQueryRequest,
    AgentQueryResponse,
)
from backend.app.services.history_service import HistoryService
from backend.app.services.query_service import QueryService

router = APIRouter(prefix="/analysis", tags=["analysis"])

@router.post("/query", response_model=AgentQueryResponse, status_code=status.HTTP_200_OK)
def run_analysis_query(
    request: AnalysisQueryRequest,
    db: Session = Depends(get_db),
):
    query_service = QueryService(db)
    return query_service.process_query(
        dataset_id=request.dataset_id,
        question=request.question,
        context=request.context,
    )

@router.get("/history", response_model=AnalysisHistoryResponse)
def get_analysis_history(
    dataset_id: Optional[str] = Query(None, description="Optional dataset ID filter"),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    history_service = HistoryService(db)
    items = history_service.get_history(dataset_id=dataset_id, limit=limit)
    return AnalysisHistoryResponse(history=items, total=len(items))

@router.get("/{result_id}", response_model=AnalysisHistoryItem)
def get_analysis_by_id(
    result_id: str,
    db: Session = Depends(get_db),
):
    history_service = HistoryService(db)
    record = history_service.get_result_by_id(result_id)
    if not record:
        raise NotFoundError(f"Analysis result '{result_id}' not found.")
    return record
