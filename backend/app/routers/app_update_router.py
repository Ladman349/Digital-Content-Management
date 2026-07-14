from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List

from app.database.database import get_db
from app.schemas.app_update import AppUpdateCreate, AppUpdateResponse, AppUpdateCheckResponse
from app.services.app_update_service import AppUpdateService

router = APIRouter(
    prefix="/app-updates",
    tags=["App Updates"]
)

@router.post("/", response_model=AppUpdateResponse, status_code=status.HTTP_201_CREATED)
def create_update(payload: AppUpdateCreate, db: Session = Depends(get_db)):
    return AppUpdateService.create_update(db, payload)

@router.get("/", response_model=List[AppUpdateResponse])
def get_all_updates(db: Session = Depends(get_db)):
    return AppUpdateService.get_all_updates(db)

@router.get("/check", response_model=AppUpdateCheckResponse)
def check_for_update(version_code: int, db: Session = Depends(get_db)):
    return AppUpdateService.check_for_update(db, version_code)

@router.put("/{id}/activate", response_model=AppUpdateResponse)
def activate_update(id: UUID, db: Session = Depends(get_db)):
    return AppUpdateService.activate_update(db, id)

@router.put("/{id}/deactivate", response_model=AppUpdateResponse)
def deactivate_update(id: UUID, db: Session = Depends(get_db)):
    return AppUpdateService.deactivate_update(db, id)

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_update(id: UUID, db: Session = Depends(get_db)):
    AppUpdateService.delete_update(db, id)
    return None
