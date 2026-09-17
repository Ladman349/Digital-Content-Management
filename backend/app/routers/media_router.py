from typing import List
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status, Request
from fastapi.responses import FileResponse, RedirectResponse, Response
import os
import uuid
import shutil
import urllib.request
from urllib.parse import urlparse
import logging
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.media import MediaUpdate, MediaResponse
from app.services.media_service import MediaService, MEDIA_CACHE_DIR
from app.core.config import settings
from app.core.auth import Principal, get_principal, require_any_device
from app.models.user import User
from app.core.storage import get_storage_provider

import threading

logger = logging.getLogger("api")

CACHE_DIR = MEDIA_CACHE_DIR
os.makedirs(CACHE_DIR, exist_ok=True)

_download_locks = {}
_global_lock = threading.Lock()

def get_media_lock(media_id: str) -> threading.Lock:
    with _global_lock:
        if media_id not in _download_locks:
            _download_locks[media_id] = threading.Lock()
        return _download_locks[media_id]

def _release_media_lock(media_id: str) -> None:
    with _global_lock:
        _download_locks.pop(media_id, None)

def _resolve_fetchable_url(clean_uri: str) -> str:
    """
    Resolve a stored media URI to a URL the proxy is allowed to fetch.
    Only storage-scheme URIs (supabase://, local://) or https URLs on the
    configured Supabase host are accepted; anything else (file://, arbitrary
    hosts, ...) is treated as not found so the proxy cannot be used for SSRF.
    """
    if clean_uri.startswith("supabase://") or clean_uri.startswith("local://"):
        public_url = get_storage_provider().get_public_url(clean_uri)
    else:
        parsed = urlparse(clean_uri)
        supabase_host = urlparse(settings.SUPABASE_URL or "").hostname
        if parsed.scheme != "https" or not supabase_host or parsed.hostname != supabase_host:
            raise HTTPException(status_code=404, detail="Media file not available")
        public_url = clean_uri

    if urlparse(public_url).scheme not in ("http", "https"):
        raise HTTPException(status_code=404, detail="Media file not available")
    return public_url

router = APIRouter(
    prefix="/media",
    tags=["Media"]
)

@router.get("", response_model=List[MediaResponse])
def get_all_media(db: Session = Depends(get_db), principal: Principal = Depends(get_principal)):
    media_list = MediaService.get_all_media(db, principal)
    return [MediaService.to_response(m) for m in media_list]

# Players fetch media here, so this is guarded by device auth rather than the admin key.
@router.get("/{media_id}/download", dependencies=[Depends(require_any_device)])
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
            logger.info(f"[MEDIA_304] Client sent matching ETag for {media_id}. Returning 304.")
            return Response(
                status_code=304,
                headers={
                    "ETag": etag,
                    "Cache-Control": "public, max-age=31536000, immutable"
                }
            )

    # Check local disk cache on Railway. The cache filename derives from the
    # stored object name (server-generated), falling back to the display name.
    clean_uri = MediaService.extract_clean_storage_uri(media.originalFile)
    ext = os.path.splitext(clean_uri)[1].lower() or os.path.splitext(media.name)[1].lower() or ".bin"
    cached_file_path = os.path.join(CACHE_DIR, f"{media.id}{ext}")

    def cache_is_valid() -> bool:
        return os.path.exists(cached_file_path) and os.path.getsize(cached_file_path) > 0

    # Thread-safe deduplication: Only one worker/thread downloads from Supabase per media_id
    if not cache_is_valid():
        with get_media_lock(media_id):
            try:
                if not cache_is_valid():
                    logger.info(f"[MEDIA_CACHE_MISS] Media {media_id} not in Railway cache. Fetching from Supabase...")
                    public_url = _resolve_fetchable_url(clean_uri)

                    # Write to a private temp file and publish atomically so a
                    # failed/partial download is never served from the cache.
                    tmp_path = f"{cached_file_path}.{uuid.uuid4().hex}.tmp"
                    try:
                        logger.info(f"[MEDIA_DOWNLOAD_SUPABASE] Downloading {media_id} from {public_url}")
                        req = urllib.request.Request(public_url, headers={"User-Agent": "Railway-Media-Proxy/1.0"})
                        with urllib.request.urlopen(req) as resp, open(tmp_path, "wb") as f:
                            shutil.copyfileobj(resp, f, length=1024 * 1024)
                        if os.path.getsize(tmp_path) == 0:
                            raise RuntimeError("Upstream returned an empty body")
                        os.replace(tmp_path, cached_file_path)
                        logger.info(f"[MEDIA_CACHE_POPULATED] Cached {media_id} ({os.path.getsize(cached_file_path)} bytes) on Railway disk")
                    except Exception as e:
                        logger.error(f"Failed to cache media {media_id} on Railway disk: {str(e)}")
                        try:
                            os.unlink(tmp_path)
                        except OSError:
                            pass
                        return RedirectResponse(public_url)
            finally:
                _release_media_lock(media_id)
    else:
        logger.info(f"[MEDIA_CACHE_HIT] Serving {media_id} directly from Railway disk cache ({os.path.getsize(cached_file_path)} bytes)")

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
def get_media(media_id: str, db: Session = Depends(get_db), principal: Principal = Depends(get_principal)):
    media = MediaService.get_media(db, media_id, principal)
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    return MediaService.to_response(media)

@router.post("/upload", response_model=MediaResponse, status_code=status.HTTP_201_CREATED)
def upload_media(file: UploadFile = File(...), db: Session = Depends(get_db), principal: Principal = Depends(get_principal)):
    # Record who uploaded it. Callers without an account (the admin key, or a deployment with no
    # accounts yet) keep the historical "Admin" label.
    uploader = db.query(User).filter(User.id == principal.user_id).first() if principal.user_id else None
    media = MediaService.upload_media(file, db, principal, uploaded_by=uploader.name if uploader else "Admin")
    return MediaService.to_response(media)

@router.put("/{media_id}", response_model=MediaResponse)
def update_media(media_id: str, payload: MediaUpdate, db: Session = Depends(get_db), principal: Principal = Depends(get_principal)):
    media = MediaService.update_media(db, media_id, payload, principal)
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    return MediaService.to_response(media)

@router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_media(media_id: str, db: Session = Depends(get_db), principal: Principal = Depends(get_principal)):
    success = MediaService.delete_media(db, media_id, principal)
    if not success:
        raise HTTPException(status_code=404, detail="Media not found")
    return None
