import logging
from fastapi import APIRouter, Depends, status, File, UploadFile, Form, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional

from app.database.database import get_db

logger = logging.getLogger("api")
from app.schemas.app_update import AppUpdateResponse, AppUpdateCheckResponse
from app.services.app_update_service import AppUpdateService

router = APIRouter(
    prefix="/app-updates",
    tags=["App Updates"]
)

@router.post("/", response_model=AppUpdateResponse, status_code=status.HTTP_201_CREATED)
def create_update(
    file: UploadFile = File(...),
    version_name: str = Form(...),
    version_code: int = Form(...),
    mandatory: bool = Form(default=False),
    is_active: bool = Form(default=False),
    release_notes: Optional[str] = Form(default=None),
    db: Session = Depends(get_db)
):
    return AppUpdateService.create_update(
        db=db,
        file=file,
        version_name=version_name,
        version_code=version_code,
        mandatory=mandatory,
        is_active=is_active,
        release_notes=release_notes
    )

@router.get("/", response_model=List[AppUpdateResponse])
def get_all_updates(db: Session = Depends(get_db)):
    return AppUpdateService.get_all_updates(db)

@router.get("/latest", response_model=AppUpdateResponse)
def get_latest_update(db: Session = Depends(get_db)):
    active_update = AppUpdateService.get_active_update(db)
    if not active_update:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active update found."
        )
    return active_update

@router.get("/ping")
def ping_updates():
    return {"status": "ok"}

@router.get("/info")
def get_app_updates_info(db: Session = Depends(get_db)):
    active_update = AppUpdateService.get_active_update(db)
    if not active_update:
        return {"message": "No active release found"}
    return {
        "versionName": active_update.version_name,
        "versionCode": active_update.version_code,
        "mandatory": active_update.mandatory,
        "uploadedAt": active_update.created_at.isoformat(),
        "downloadCount": active_update.download_count,
        "fileSize": active_update.file_size,
        "checksum": active_update.checksum_sha256
    }

@router.get("/check", response_model=AppUpdateCheckResponse)
def check_for_update(version_code: int, db: Session = Depends(get_db)):
    return AppUpdateService.check_for_update(db, version_code)

@router.get("/download/{filename}")
def download_update(filename: str, db: Session = Depends(get_db)):
    # 1. Retrieve the file path from service
    file_path = AppUpdateService.get_apk_path(filename)
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Requested update file not found."
        )
        
    # 2. Increment download count and update timestamp (best-effort)
    try:
        AppUpdateService.track_download(db, filename)
    except Exception as e:
        logger.warning(f"Failed to track download metrics for {filename}: {str(e)}", exc_info=True)
    
    # 3. Return FileResponse with custom disposition and no-cache headers
    return FileResponse(
        path=str(file_path),
        media_type="application/vnd.android.package-archive",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )

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
