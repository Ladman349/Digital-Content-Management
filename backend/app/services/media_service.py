import os
import shutil
import uuid
import time
from typing import List

from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session
from PIL import Image

from app.models.media import Media
from app.schemas.media import MediaUpdate


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

        safe_name = os.path.splitext(file.filename)[0].replace(" ", "_")
        unique_filename = f"{safe_name}_{uuid.uuid4().hex[:8]}{ext}"
        
        os.makedirs(MediaService.MEDIA_FOLDER, exist_ok=True)
        file_path = os.path.join(MediaService.MEDIA_FOLDER, unique_filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        import hashlib
        sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                sha256.update(chunk)
        checksum = sha256.hexdigest()
            
        dimensions = "Unknown"
        media_type = "Image"
        duration = None
        
        if ext in MediaService.IMAGE_EXTENSIONS:
            media_type = "Image"
            try:
                with Image.open(file_path) as img:
                    dimensions = f"{img.width}x{img.height}"
            except Exception:
                dimensions = "Unknown"
        else:
            media_type = "Video"
            dimensions = "1920x1080"
            duration = 120
            
        new_media = Media(
            id=f"MEDIA-{uuid.uuid4().hex[:8].upper()}",
            name=file.filename,
            type=media_type,
            category="Announcement",
            thumbnail=f"http://localhost:8000/uploads/{unique_filename}",
            originalFile=f"http://localhost:8000/uploads/{unique_filename}",
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
            
        file_name = media.originalFile.split("/")[-1]
        path = os.path.join(MediaService.MEDIA_FOLDER, file_name)
            
        try:
            db.delete(media)
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=409, detail="Cannot delete media because it is referenced by one or more playlists.")
            
        if os.path.exists(path):
            os.remove(path)
            
        return True