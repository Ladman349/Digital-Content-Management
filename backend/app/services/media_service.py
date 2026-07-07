import os
import uuid
import time
import io
import hashlib
import logging
from typing import List

from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session
from PIL import Image

from app.models.media import Media
from app.schemas.media import MediaUpdate, MediaResponse
from app.core.storage import get_storage_provider

logger = logging.getLogger("api")

class MediaService:

    MEDIA_FOLDER = "media"
    IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
    VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov"}

    @staticmethod
    def upload_media(
        file: UploadFile,
        db: Session
    ) -> Media:

        ext = os.path.splitext(file.filename)[1].lower()
        if not ext:
            ext = ".bin"
        
        if ext not in MediaService.IMAGE_EXTENSIONS and ext not in MediaService.VIDEO_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")
            
        file.file.seek(0, os.SEEK_END)
        size = file.file.tell()
        file.file.seek(0)
        
        if size == 0:
            raise HTTPException(status_code=400, detail="File is empty")
        
        if size > 100 * 1024 * 1024:  # 100MB
            raise HTTPException(status_code=400, detail="File is too large")
        
        file_content = file.file.read()
        
        # Compute checksum
        sha256 = hashlib.sha256()
        sha256.update(file_content)
        checksum = sha256.hexdigest()
            
        dimensions = "Unknown"
        media_type = "Image"
        duration = None
        
        if ext in MediaService.IMAGE_EXTENSIONS:
            media_type = "Image"
            try:
                with Image.open(io.BytesIO(file_content)) as img:
                    dimensions = f"{img.width}x{img.height}"
            except Exception:
                dimensions = "Unknown"
        else:
            media_type = "Video"
            dimensions = "1920x1080"
            duration = 120
            
        safe_name = os.path.splitext(file.filename)[0].replace(" ", "_")
        unique_filename = f"{safe_name}_{uuid.uuid4().hex[:8]}{ext}"
        
        provider = get_storage_provider()
        logger.info(f"Uploading media filename={file.filename} size={size} provider={provider.__class__.__name__}")
        
        storage_uri = provider.upload(file_content, unique_filename, file.content_type)
        
        media_id = f"MEDIA-{uuid.uuid4().hex[:8].upper()}"
        new_media = Media(
            id=media_id,
            name=file.filename,
            type=media_type,
            category="Announcement",
            thumbnail=storage_uri,
            originalFile=storage_uri,
            size=size,
            dimensions=dimensions,
            duration=duration,
            uploadedAt=int(time.time() * 1000),
            uploadedBy="Admin",
            checksum=checksum
        )
        
        db.add(new_media)
        db.commit()
        db.refresh(new_media)
        
        logger.info(f"Media uploaded mediaId={media_id} provider={provider.__class__.__name__} uri={storage_uri}")
        return new_media

    @staticmethod
    def get_all_media(db: Session) -> List[Media]:
        return db.query(Media).all()

    @staticmethod
    def get_media(db: Session, media_id: str) -> Media:
        return db.query(Media).filter(Media.id == media_id).first()

    @staticmethod
    def update_media(db: Session, media_id: str, payload: MediaUpdate) -> Media:
        media = db.query(Media).filter(Media.id == media_id).first()
        if not media:
            return None
        
        update_data = payload.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(media, key, value)
            
        db.commit()
        db.refresh(media)
        return media

    @staticmethod
    def delete_media(db: Session, media_id: str) -> bool:
        from sqlalchemy.exc import IntegrityError
        media = db.query(Media).filter(Media.id == media_id).first()
        if not media:
            return False
            
        provider = get_storage_provider()
            
        try:
            db.delete(media)
            db.commit()
            logger.info(f"Media deleted from database mediaId={media_id}")
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=409, detail="Cannot delete media because it is referenced by one or more playlists.")
            
        try:
            provider.delete(media.originalFile)
            logger.info(f"Media deleted from storage uri={media.originalFile}")
        except Exception as e:
            logger.error(f"Failed to delete media from storage uri={media.originalFile}: {str(e)}")
            
        return True

    @staticmethod
    def to_response(media: Media) -> MediaResponse:
        provider = get_storage_provider()
        return MediaResponse(
            id=media.id,
            name=media.name,
            type=media.type,
            category=media.category,
            thumbnail=provider.get_public_url(media.thumbnail),
            originalFile=provider.get_public_url(media.originalFile),
            size=media.size,
            dimensions=media.dimensions,
            duration=media.duration,
            uploadedAt=media.uploadedAt,
            uploadedBy=media.uploadedBy,
            checksum=media.checksum
        )