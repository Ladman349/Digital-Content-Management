from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from uuid import UUID
from app.models.app_update import AppUpdate
from app.schemas.app_update import AppUpdateCreate, AppUpdateCheckResponse

class AppUpdateService:
    @staticmethod
    def create_update(db: Session, update_in: AppUpdateCreate) -> AppUpdate:
        # Check unique version code
        existing = db.query(AppUpdate).filter(AppUpdate.version_code == update_in.version_code).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Version code {update_in.version_code} already exists."
            )
        
        db_obj = AppUpdate(
            version_name=update_in.version_name,
            version_code=update_in.version_code,
            apk_filename=update_in.apk_filename,
            apk_url=update_in.apk_url,
            checksum_sha256=update_in.checksum_sha256,
            file_size=update_in.file_size,
            release_notes=update_in.release_notes,
            mandatory=update_in.mandatory,
            is_active=update_in.is_active
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
        # Get active update with highest version_code
        return db.query(AppUpdate).filter(AppUpdate.is_active == True).order_by(AppUpdate.version_code.desc()).first()

    @staticmethod
    def check_for_update(db: Session, client_version_code: int) -> AppUpdateCheckResponse:
        active_update = AppUpdateService.get_active_update(db)
        if not active_update or active_update.version_code <= client_version_code:
            return AppUpdateCheckResponse(update_available=False)
            
        return AppUpdateCheckResponse(
            update_available=True,
            version_name=active_update.version_name,
            version_code=active_update.version_code,
            apk_url=active_update.apk_url,
            checksum_sha256=active_update.checksum_sha256,
            file_size=active_update.file_size,
            mandatory=active_update.mandatory,
            release_notes=active_update.release_notes
        )

    @staticmethod
    def activate_update(db: Session, update_id: UUID) -> AppUpdate:
        db_obj = db.query(AppUpdate).filter(AppUpdate.id == update_id).first()
        if not db_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"App update with ID {update_id} not found."
            )
            
        # Deactivate all other updates
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
        db.delete(db_obj)
        db.commit()
