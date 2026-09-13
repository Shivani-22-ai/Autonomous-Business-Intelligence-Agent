from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.schemas.dataset import (
    DatasetListResponse,
    DatasetMetadata,
    DatasetUploadResponse,
)
from backend.app.services.dataset_service import DatasetService

router = APIRouter(prefix="/datasets", tags=["datasets"])

@router.post("/upload", response_model=DatasetUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_dataset(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    service = DatasetService(db)
    contents = await file.read()
    metadata = service.save_and_profile_file(filename=file.filename or "dataset.csv", content_bytes=contents)
    return DatasetUploadResponse(
        message="Dataset uploaded and profiled successfully",
        dataset=metadata,
    )

@router.get("", response_model=DatasetListResponse)
def list_datasets(db: Session = Depends(get_db)):
    service = DatasetService(db)
    datasets = service.list_datasets()
    return DatasetListResponse(datasets=datasets, total=len(datasets))

@router.get("/{dataset_id}/profile", response_model=DatasetMetadata)
def get_dataset_profile(dataset_id: str, db: Session = Depends(get_db)):
    service = DatasetService(db)
    return service.get_dataset_metadata(dataset_id)
