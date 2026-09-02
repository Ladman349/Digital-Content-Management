from typing import List
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status, Request
from fastapi.responses import FileResponse, RedirectResponse, Response
import os
import urllib.request
import logging
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.media import MediaUpdate, MediaResponse
from app.services.media_service import MediaService
from app.core.config import settings

logger = logging.getLogger("api")

CACHE_DIR = os.path.join(os.getcwd(), "media_cache")
os.makedirs(CACHE_DIR, exist_ok=True)

router = APIRouter(
    prefix="/media",
    tags=["Media"]
)

@router.get("", response_model=List[MediaResponse])
def get_all_media(db: Session = Depends(get_db)):
    media_list = MediaService.get_all_media(db)
    return [MediaService.to_response(m) for m in media_list]

@router.get("/{media_id}/download")
def download_media(media_id: str, request: Request, db: Session = Depends(get_db)):
    media = MediaService.get_media(db, media_id)
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")

    etag = f'"{media.checksum}"' if media.checksum else f'"{media.id}"'
    if_none_match = request.headers.get("if-none-match")
    if if_none_match:
        clean_inm = if_none_match.strip().strip('"')
        clean_etag = etag.strip('"')
        if clean_inm == clean_etag or if_none_match.strip() == etag:
            return Response(
                status_code=304,
                headers={
                    "ETag": etag,
                    "Cache-Control": "public, max-age=31536000, immutable"
                }
            )

    # Check local disk cache on Railway
    ext = os.path.splitext(media.name)[1].lower() or ".bin"
    cached_file_path = os.path.join(CACHE_DIR, f"{media.id}{ext}")
    
    # If not cached on Railway disk, fetch from Supabase ONCE and store locally
    if not os.path.exists(cached_file_path) or os.path.getsize(cached_file_path) == 0:
        clean_uri = MediaService.extract_clean_storage_uri(media.originalFile)
        from app.core.storage import get_storage_provider
        public_url = get_storage_provider().get_public_url(clean_uri)
        
        try:
            logger.info(f"Populating Railway disk cache for media {media_id} from Supabase: {public_url}")
            req = urllib.request.Request(public_url, headers={"User-Agent": "Railway-Media-Proxy/1.0"})
            with urllib.request.urlopen(req) as resp, open(cached_file_path, "wb") as f:
                f.write(resp.read())
            logger.info(f"Successfully cached media {media_id} on Railway disk ({os.path.getsize(cached_file_path)} bytes)")
        except Exception as e:
            logger.error(f"Failed to cache media {media_id} on Railway disk: {str(e)}")
            return RedirectResponse(public_url)

    # Serve directly from Railway disk with Range support and 1-year caching
    return FileResponse(
        path=cached_file_path,
        filename=media.name,
        headers={
            "ETag": etag,
            "Cache-Control": "public, max-age=31536000, immutable"
        }
    )

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