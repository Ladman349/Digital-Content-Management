import os
import uuid
import time
import glob
import hashlib
import logging
import mimetypes
from typing import List

from fastapi import UploadFile, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from PIL import Image

from app.models.media import Media
from app.models.playlist_item import PlaylistItem
from app.schemas.media import MediaUpdate, MediaResponse
from app.core.storage import get_storage_provider
from app.core.tenancy import apply_owner_change, owner_for_new, scope_query, visible

logger = logging.getLogger("api")

# Shared with media_router: on-disk cache of proxied media downloads
MEDIA_CACHE_DIR = os.getenv("MEDIA_CACHE_DIR", os.path.join(os.getcwd(), "media_cache"))

class MediaService:

    MEDIA_FOLDER = "media"
    IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
    VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov"}
    MAX_UPLOAD_BYTES = 100 * 1024 * 1024  # 100MB
    CHUNK_SIZE = 4 * 1024 * 1024

    @staticmethod
    def upload_media(
        file: UploadFile,
        db: Session,
        principal=None,
        uploaded_by: str = "Admin",
    ) -> Media:

        # Keep only the leaf name of whatever the client sent; it is used for display only
        original_name = os.path.basename((file.filename or "").replace("\\", "/")).strip()
        if not original_name:
            raise HTTPException(status_code=400, detail="Filename is required")

        ext = os.path.splitext(original_name)[1].lower()
        if not ext:
            ext = ".bin"

        if ext not in MediaService.IMAGE_EXTENSIONS and ext not in MediaService.VIDEO_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

        file.file.seek(0, os.SEEK_END)
        size = file.file.tell()
        file.file.seek(0)

        if size == 0:
            raise HTTPException(status_code=400, detail="File is empty")

        if size > MediaService.MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=400, detail="File is too large")

        # Compute checksum incrementally without loading the file into memory
        sha256 = hashlib.sha256()
        while True:
            chunk = file.file.read(MediaService.CHUNK_SIZE)
            if not chunk:
                break
            sha256.update(chunk)
        checksum = sha256.hexdigest()

        file.file.seek(0)

        dimensions = "Unknown"
        media_type = "Image"
        duration = None

        if ext in MediaService.IMAGE_EXTENSIONS:
            media_type = "Image"
            try:
                with Image.open(file.file) as img:
                    dimensions = f"{img.width}x{img.height}"
            except Exception:
                dimensions = "Unknown"
            file.file.seek(0)
        else:
            # Video metadata is not probed server-side; the CMS updates
            # dimensions/duration via PUT /media/{id} after client-side probing.
            media_type = "Video"
            dimensions = "Unknown"
            duration = None

        # Object names are generated server-side from the media ID and the
        # validated extension so the client can never influence storage paths.
        media_id = f"MEDIA-{uuid.uuid4().hex[:8].upper()}"
        object_name = f"{media_id}{ext}"
        content_type = mimetypes.guess_type(object_name)[0] or "application/octet-stream"

        provider = get_storage_provider()
        logger.info(f"Uploading media filename={original_name} size={size} provider={provider.__class__.__name__}")

        storage_uri = provider.upload(file.file, object_name, content_type, size)

        new_media = Media(
            id=media_id,
            name=original_name,
            type=media_type,
            category="Announcement",
            thumbnail=storage_uri if media_type == "Image" else "",
            originalFile=storage_uri,
            size=size,
            dimensions=dimensions,
            duration=duration,
            uploadedAt=int(time.time() * 1000),
            uploadedBy=uploaded_by,
            checksum=checksum,
            clientId=owner_for_new(principal),
        )

        db.add(new_media)
        db.commit()
        db.refresh(new_media)

        logger.info(f"Media uploaded mediaId={media_id} provider={provider.__class__.__name__} uri={storage_uri}")
        return new_media

    @staticmethod
    def get_all_media(db: Session, principal=None) -> List[Media]:
        return scope_query(db.query(Media), Media, principal).all()

    @staticmethod
    def get_media(db: Session, media_id: str, principal=None) -> Media:
        return visible(db.query(Media).filter(Media.id == media_id).first(), principal)

    @staticmethod
    def update_media(db: Session, media_id: str, payload: MediaUpdate, principal=None) -> Media:
        media = visible(db.query(Media).filter(Media.id == media_id).first(), principal)
        if not media:
            return None

        update_data = payload.model_dump(exclude_unset=True)
        apply_owner_change(media, update_data, principal, db)
        for key, value in update_data.items():
            setattr(media, key, value)

        db.commit()
        db.refresh(media)
        from app.core.cache import PlayerCache
        PlayerCache.invalidate_all()
        return media

    @staticmethod
    def delete_media(db: Session, media_id: str, principal=None) -> bool:
        from sqlalchemy.exc import IntegrityError
        media = visible(db.query(Media).filter(Media.id == media_id).first(), principal)
        if not media:
            return False

        # The DB FK is ON DELETE CASCADE in production, so guard explicitly
        # instead of relying on an IntegrityError that never fires.
        playlist_count = (
            db.query(func.count(func.distinct(PlaylistItem.playlistId)))
            .filter(PlaylistItem.mediaId == media_id)
            .scalar()
        ) or 0
        if playlist_count > 0:
            raise HTTPException(
                status_code=409,
                detail=f"Cannot delete media because it is used by {playlist_count} playlist(s). Remove it from those playlists first."
            )

        provider = get_storage_provider()

        try:
            db.delete(media)
            db.commit()
            logger.info(f"Media deleted from database mediaId={media_id}")
            from app.core.cache import PlayerCache
            PlayerCache.invalidate_all()
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=409, detail="Cannot delete media because it is referenced by one or more playlists.")

        try:
            provider.delete(media.originalFile)
            logger.info(f"Media deleted from storage uri={media.originalFile}")
        except Exception as e:
            logger.error(f"Failed to delete media from storage uri={media.originalFile}: {str(e)}")

        try:
            for f in glob.glob(os.path.join(MEDIA_CACHE_DIR, f"{media_id}.*")):
                if os.path.exists(f):
                    os.remove(f)
        except Exception as e:
            logger.warning(f"Failed to delete local cached media {media_id}: {str(e)}")

        return True

    @staticmethod
    def extract_clean_storage_uri(raw_uri: str | None) -> str:
        if not raw_uri:
            return ""
        if "supabase://" in raw_uri:
            return "supabase://" + raw_uri.split("supabase://", 1)[1]
        if "local://" in raw_uri:
            return "local://" + raw_uri.split("local://", 1)[1]
        return raw_uri

    @staticmethod
    def to_response(media: Media, request_base_url: str | None = None) -> MediaResponse:
        provider = get_storage_provider()
        clean_thumbnail = MediaService.extract_clean_storage_uri(media.thumbnail)
        clean_original = MediaService.extract_clean_storage_uri(media.originalFile)

        # Sanitize video thumbnails so browsers never download raw video files as CSS backgrounds
        if media.type == "Video" and (not clean_thumbnail or clean_thumbnail == clean_original or any(clean_thumbnail.lower().endswith(ext) for ext in ('.mov', '.mp4', '.webm', '.mkv', '.avi'))):
            thumb_url = ""
        else:
            thumb_url = provider.get_public_url(clean_thumbnail, base_url_override=request_base_url) if clean_thumbnail else ""

        orig_url = provider.get_public_url(clean_original, base_url_override=request_base_url)

        return MediaResponse(
            id=media.id,
            name=media.name,
            type=media.type,
            category=media.category,
            thumbnail=thumb_url,
            originalFile=orig_url,
            size=media.size,
            dimensions=media.dimensions,
            duration=media.duration,
            uploadedAt=media.uploadedAt,
            uploadedBy=media.uploadedBy,
            checksum=media.checksum,
            clientId=media.clientId,
        )
