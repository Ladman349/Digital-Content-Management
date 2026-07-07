from typing import List
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from fastapi.responses import FileResponse
import os
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.media import MediaUpdate, MediaResponse
from app.services.media_service import MediaService

router = APIRouter(
    prefix="/media",
    tags=["Media"]
)

@router.get("", response_model=List[MediaResponse])
def get_all_media(db: Session = Depends(get_db)):
    media_list = MediaService.get_all_media(db)
    return [MediaService.to_response(m) for m in media_list]

@router.get("/{media_id}/download")
def download_media(media_id: str, db: Session = Depends(get_db)):
    media = MediaService.get_media(db, media_id)
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
        
    if media.originalFile.startswith("supabase://"):
        from fastapi.responses import RedirectResponse
        from app.core.storage import get_storage_provider
        public_url = get_storage_provider().get_public_url(media.originalFile)
        return RedirectResponse(public_url)
        
    filename = media.originalFile.replace("local://", "")
    file_path = os.path.join("media", filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(file_path, filename=media.name, media_type="application/octet-stream")

@router.get("/{media_id}", response_model=MediaResponse)
def get_media(media_id: str, db: Session = Depends(get_db)):
    media = MediaService.get_media(db, media_id)
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    return MediaService.to_response(media)

@router.post("/upload", response_model=MediaResponse, status_code=status.HTTP_201_CREATED)
def upload_media(file: UploadFile = File(...), db: Session = Depends(get_db)):
    media = MediaService.upload_media(file, db)
    return MediaService.to_response(media)

@router.put("/{media_id}", response_model=MediaResponse)
def update_media(media_id: str, payload: MediaUpdate, db: Session = Depends(get_db)):
    media = MediaService.update_media(db, media_id, payload)
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    return MediaService.to_response(media)

@router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_media(media_id: str, db: Session = Depends(get_db)):
    success = MediaService.delete_media(db, media_id)
    if not success:
        raise HTTPException(status_code=404, detail="Media not found")
    return None