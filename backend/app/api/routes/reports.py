from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from backend.app.core.errors import NotFoundError
from backend.app.db.session import get_db
from backend.app.schemas.report import ReportGenerateRequest, ReportResponse
from backend.app.services.report_service import ReportService

router = APIRouter(prefix="/reports", tags=["reports"])

@router.post("/generate", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
def generate_report(
    request: ReportGenerateRequest,
    db: Session = Depends(get_db),
):
    service = ReportService(db)
    return service.generate_report(
        dataset_id=request.dataset_id,
        title=request.title,
        focus_areas=request.focus_areas,
    )

@router.get("/{report_id}", response_model=ReportResponse)
def get_report_by_id(
    report_id: str,
    db: Session = Depends(get_db),
):
    service = ReportService(db)
    report = service.get_report(report_id)
    if not report:
        raise NotFoundError(f"Report '{report_id}' not found.")
    return report
