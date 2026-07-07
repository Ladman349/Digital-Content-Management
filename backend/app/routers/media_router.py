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
    return MediaService.get_all_media(db)

@router.get("/{media_id}/download")
def download_media(media_id: str, db: Session = Depends(get_db)):
    media = MediaService.get_media(db, media_id)
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    # Extract filename from stored URL, serve from media/ folder
    file_name = media.originalFile.split("/")[-1]
    file_path = os.path.join("media", file_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(file_path, filename=media.name, media_type="application/octet-stream")

@router.get("/{media_id}", response_model=MediaResponse)
def get_media(media_id: str, db: Session = Depends(get_db)):
    media = MediaService.get_media(db, media_id)
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    return media

@router.post("/upload", response_model=MediaResponse, status_code=status.HTTP_201_CREATED)
def upload_media(file: UploadFile = File(...), db: Session = Depends(get_db)):
    return MediaService.upload_media(file, db)

@router.put("/{media_id}", response_model=MediaResponse)
def update_media(media_id: str, payload: MediaUpdate, db: Session = Depends(get_db)):
    media = MediaService.update_media(db, media_id, payload)
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    return media

@router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_media(media_id: str, db: Session = Depends(get_db)):
    success = MediaService.delete_media(db, media_id)
    if not success:
        raise HTTPException(status_code=404, detail="Media not found")
    return None