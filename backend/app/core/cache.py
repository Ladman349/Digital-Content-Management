import time
from typing import Optional, Dict, Tuple
from app.schemas.player import CurrentPlaylistResponse

class PlayerCache:
    """
    Thread-safe in-memory cache for device active playlist responses and ETags.
    Dramatically reduces Supabase database read queries by serving repeated
    15-second TV player polls directly from RAM.
    """
    _cache: Dict[str, Tuple[float, Optional[CurrentPlaylistResponse], str]] = {}
    TTL_SECONDS: int = 30  # Re-validate with DB every 30 seconds if not explicitly invalidated

    @classmethod
    def get(cls, device_id: str) -> Optional[Tuple[Optional[CurrentPlaylistResponse], str]]:
        entry = cls._cache.get(device_id)
        if not entry:
            return None
        cached_time, result, etag = entry
        if time.time() - cached_time > cls.TTL_SECONDS:
            cls._cache.pop(device_id, None)
            return None
        return result, etag

    @classmethod
    def set(cls, device_id: str, result: Optional[CurrentPlaylistResponse], etag: str) -> None:
        cls._cache[device_id] = (time.time(), result, etag)

    @classmethod
    def invalidate_device(cls, device_id: str) -> None:
        cls._cache.pop(device_id, None)

    @classmethod
    def invalidate_all(cls) -> None:
        cls._cache.clear()
