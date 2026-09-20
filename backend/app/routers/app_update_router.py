import logging
from fastapi import APIRouter, Depends, status, File, UploadFile, Form, HTTPException
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.orm import Session
from uuid import UUID
from pathlib import Path
from typing import List, Optional

from app.database.database import get_db

logger = logging.getLogger("api")
from app.schemas.app_update import AppUpdateResponse, AppUpdateCheckResponse
from app.core.auth import Principal, require_admin, require_any_device
from app.services.audit_service import AuditService
from app.services.app_update_service import AppUpdateService

router = APIRouter(
    prefix="/app-updates",
    tags=["App Updates"]
)

@router.post("/", response_model=AppUpdateResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
def create_update(
    file: UploadFile = File(...),
    version_name: str = Form(...),
    version_code: int = Form(...),
    mandatory: bool = Form(default=False),
    is_active: bool = Form(default=False),
    release_notes: Optional[str] = Form(default=None),
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_admin),
):
    update = AppUpdateService.create_update(
        db=db,
        file=file,
        version_name=version_name,
        version_code=version_code,
        mandatory=mandatory,
        is_active=is_active,
        release_notes=release_notes
    )
    AuditService.record(db, principal, "uploaded", "release", str(update.id), f"{update.version_name} ({update.version_code})", None, "active" if update.is_active else "not active yet")
    return update

@router.get("/", response_model=List[AppUpdateResponse], dependencies=[Depends(require_admin)])
def get_all_updates(db: Session = Depends(get_db)):
    return AppUpdateService.get_all_updates(db)

@router.get("/latest", response_model=AppUpdateResponse, dependencies=[Depends(require_admin)])
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

@router.get("/info", dependencies=[Depends(require_admin)])
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

# Players poll this for the active release.
@router.get("/check", response_model=AppUpdateCheckResponse, dependencies=[Depends(require_any_device)])
def check_for_update(version_code: int, db: Session = Depends(get_db)):
    return AppUpdateService.check_for_update(db, version_code)

@router.get("/download/{filename}", dependencies=[Depends(require_any_device)])
def download_update(filename: str, db: Session = Depends(get_db)):
    # 0. Reject anything that is not a plain leaf filename (no path traversal)
    if not filename or "\\" in filename or Path(filename).name != filename:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Requested update file not found."
        )

    # 1. Locate the release record
    update = AppUpdateService.get_by_filename(db, filename)
    if not update:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Requested update file not found."
        )

    # 2. Increment download count and update timestamp (best-effort)
    try:
        AppUpdateService.track_download(db, filename)
    except Exception as e:
        logger.warning(f"Failed to track download metrics for {filename}: {str(e)}", exc_info=True)

    # 3. Prefer object storage. Players follow the redirect, so the APK is served straight from
    #    the bucket and stays available across backend redeploys.
    storage_url = AppUpdateService.resolve_storage_url(update)
    if storage_url:
        return RedirectResponse(url=storage_url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)

    # 4. Fall back to the local staging copy (dev, or releases uploaded before object storage).
    file_path = AppUpdateService.get_apk_path(filename)
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "This release is recorded in the database but its APK is missing from disk and it "
                "was never copied to object storage. Re-upload the release."
            )
        )

    # 3. Return FileResponse with custom disposition and no-cache headers
    return FileResponse(
        path=str(file_path),
        media_type="application/vnd.android.package-archive",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )

@router.put("/{id}/activate", response_model=AppUpdateResponse, dependencies=[Depends(require_admin)])
def activate_update(id: UUID, db: Session = Depends(get_db), principal: Principal = Depends(require_admin)):
    update = AppUpdateService.activate_update(db, id)
    AuditService.record(db, principal, "activated", "release", str(update.id), f"{update.version_name} ({update.version_code})")
    return update

@router.put("/{id}/deactivate", response_model=AppUpdateResponse, dependencies=[Depends(require_admin)])
def deactivate_update(id: UUID, db: Session = Depends(get_db), principal: Principal = Depends(require_admin)):
    update = AppUpdateService.deactivate_update(db, id)
    AuditService.record(db, principal, "deactivated", "release", str(update.id), f"{update.version_name} ({update.version_code})")
    return update

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
def delete_update(id: UUID, db: Session = Depends(get_db), principal: Principal = Depends(require_admin)):
    AppUpdateService.delete_update(db, id)
    AuditService.record(db, principal, "deleted", "release", str(id))
    return None
