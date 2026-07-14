import hashlib
import time
import shutil
from pathlib import Path
from typing import Optional
from uuid import UUID
from datetime import datetime

from fastapi import UploadFile, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.app_update import AppUpdate
from app.schemas.app_update import AppUpdateCheckResponse

class AppUpdateService:
    @staticmethod
    def create_update(
        db: Session,
        file: UploadFile,
        version_name: str,
        version_code: int,
        mandatory: bool,
        is_active: bool,
        release_notes: Optional[str]
    ) -> AppUpdate:
        
        # 1. Verify version code uniqueness before doing any file writes
        existing = db.query(AppUpdate).filter(AppUpdate.version_code == version_code).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A release with version code {version_code} already exists."
            )
            
        # 2. Validate extension
        ext = Path(file.filename).suffix.lower()
        if ext != ".apk":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only .apk files are allowed."
            )
            
        # 3. Setup folders using pathlib
        uploads_dir = Path("uploads")
        apk_dir = uploads_dir / "apk"
        apk_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate safe unique filename
        safe_filename = f"player-v{version_code}-{int(time.time())}.apk"
        final_path = apk_dir / safe_filename
        tmp_path = apk_dir / f"{safe_filename}.tmp"
        
        # 4. Stream upload while hashing and checking size
        sha256_hash = hashlib.sha256()
        total_bytes = 0
        max_bytes = settings.OTA_MAX_UPLOAD_MB * 1024 * 1024
        
        try:
            with open(tmp_path, "wb") as buffer:
                while chunk := file.file.read(1024 * 1024):  # 1MB chunks
                    total_bytes += len(chunk)
                    if total_bytes > max_bytes:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"File exceeds maximum upload limit of {settings.OTA_MAX_UPLOAD_MB}MB."
                        )
                    sha256_hash.update(chunk)
                    buffer.write(chunk)
            
            # File written successfully, calculate checksum and rename atomically
            checksum = sha256_hash.hexdigest()
            tmp_path.rename(final_path)
            
        except Exception as e:
            # Cleanup temp file on failure
            if tmp_path.exists():
                tmp_path.unlink()
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"File write failed: {str(e)}"
            )
            
        # 5. Build dynamic download URL (using PUBLIC_BASE_URL if configured)
        import os
        base_url = os.getenv("PUBLIC_BASE_URL", settings.API_BASE_URL).rstrip('/')
        apk_url = f"{base_url}/api/v1/app-updates/download/{safe_filename}"
        
        # 6. Save metadata record to DB
        db_obj = AppUpdate(
            version_name=version_name,
            version_code=version_code,
            apk_filename=safe_filename,
            apk_url=apk_url,
            checksum_sha256=checksum,
            file_size=total_bytes,
            release_notes=release_notes,
            mandatory=mandatory,
            is_active=is_active
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        
        # If this update was created active, deactivate other updates
        if db_obj.is_active:
            AppUpdateService.activate_update(db, db_obj.id)
            
        return db_obj

    @staticmethod
    def get_all_updates(db: Session):
        return db.query(AppUpdate).order_by(AppUpdate.version_code.desc()).all()

    @staticmethod
    def get_active_update(db: Session) -> AppUpdate | None:
        return db.query(AppUpdate).filter(AppUpdate.is_active == True).order_by(AppUpdate.version_code.desc()).first()

    @staticmethod
    def check_for_update(db: Session, client_version_code: int) -> AppUpdateCheckResponse:
        active_update = AppUpdateService.get_active_update(db)
        if not active_update:
            return AppUpdateCheckResponse(
                updateAvailable=False,
                currentVersionCode=client_version_code,
                latestVersionCode=client_version_code
            )
            
        if active_update.version_code <= client_version_code:
            return AppUpdateCheckResponse(
                updateAvailable=False,
                currentVersionCode=client_version_code,
                latestVersionCode=active_update.version_code
            )
            
        return AppUpdateCheckResponse(
            updateAvailable=True,
            currentVersionCode=client_version_code,
            latestVersionCode=active_update.version_code,
            versionName=active_update.version_name,
            apkUrl=active_update.apk_url,
            checksum=active_update.checksum_sha256,
            fileSize=active_update.file_size,
            mandatory=active_update.mandatory,
            releaseNotes=active_update.release_notes
        )

    @staticmethod
    def track_download(db: Session, filename: str) -> AppUpdate | None:
        db_obj = db.query(AppUpdate).filter(AppUpdate.apk_filename == filename).first()
        if not db_obj:
            return None
        
        db_obj.download_count += 1
        db_obj.last_downloaded_at = datetime.now()
        db.commit()
        db.refresh(db_obj)
        return db_obj

    @staticmethod
    def get_apk_path(filename: str) -> Path:
        return Path("uploads") / "apk" / filename

    @staticmethod
    def activate_update(db: Session, update_id: UUID) -> AppUpdate:
        db_obj = db.query(AppUpdate).filter(AppUpdate.id == update_id).first()
        if not db_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"App update with ID {update_id} not found."
            )
            
        # Deactivate all other updates in the same transaction
        db.query(AppUpdate).filter(AppUpdate.id != update_id).update({AppUpdate.is_active: False})
        
        # Activate this update
        db_obj.is_active = True
        db.commit()
        db.refresh(db_obj)
        return db_obj

    @staticmethod
    def deactivate_update(db: Session, update_id: UUID) -> AppUpdate:
        db_obj = db.query(AppUpdate).filter(AppUpdate.id == update_id).first()
        if not db_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"App update with ID {update_id} not found."
            )
        db_obj.is_active = False
        db.commit()
        db.refresh(db_obj)
        return db_obj

    @staticmethod
    def delete_update(db: Session, update_id: UUID):
        db_obj = db.query(AppUpdate).filter(AppUpdate.id == update_id).first()
        if not db_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"App update with ID {update_id} not found."
            )
            
        # Move the physical file to uploads/apk/archive/ instead of hard-deleting
        apk_dir = Path("uploads") / "apk"
        file_path = apk_dir / db_obj.apk_filename
        
        if file_path.exists():
            try:
                archive_dir = apk_dir / "archive"
                archive_dir.mkdir(parents=True, exist_ok=True)
                # Generate timestamped archive filename
                timestamp = datetime.now().strftime("%Y%m%dT%H%M%S")
                stem = Path(db_obj.apk_filename).stem
                archive_filename = f"{stem}-{timestamp}.apk"
                # Archive the file
                shutil.move(str(file_path), str(archive_dir / archive_filename))
            except Exception:
                # Fallback to delete if archive move fails
                try:
                    file_path.unlink()
                except Exception:
                    pass
                    
        db.delete(db_obj)
        db.commit()
