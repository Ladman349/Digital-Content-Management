import time
import threading
from typing import Optional, Dict, Tuple
from app.schemas.player import CurrentPlaylistResponse

class PlayerCache:
    """
    Thread-safe in-memory cache for device active playlist responses and ETags.
    Dramatically reduces Supabase database read queries by serving repeated
    15-second TV player polls directly from RAM.

    All access to the underlying dict is guarded by a single lock because
    request handlers run concurrently in the threadpool.
    """
    _cache: Dict[str, Tuple[float, Optional[CurrentPlaylistResponse], str]] = {}
    _lock = threading.Lock()
    TTL_SECONDS: int = 30  # Re-validate with DB every 30 seconds if not explicitly invalidated
    SWEEP_THRESHOLD: int = 500

    @classmethod
    def get(cls, device_id: str) -> Optional[Tuple[Optional[CurrentPlaylistResponse], str]]:
        with cls._lock:
            entry = cls._cache.get(device_id)
            if not entry:
                return None
            cached_time, result, etag = entry
            if time.time() - cached_time > cls.TTL_SECONDS:
                cls._cache.pop(device_id, None)
                return None
            return result, etag

    @classmethod
    def _sweep_locked(cls):
        # Caller must hold cls._lock
        if len(cls._cache) > cls.SWEEP_THRESHOLD:
            current_time = time.time()
            keys_to_remove = [k for k, v in cls._cache.items() if current_time - v[0] > cls.TTL_SECONDS]
            for k in keys_to_remove:
                cls._cache.pop(k, None)

    @classmethod
    def set(cls, device_id: str, result: Optional[CurrentPlaylistResponse], etag: str) -> None:
        with cls._lock:
            cls._sweep_locked()
            cls._cache[device_id] = (time.time(), result, etag)

    @classmethod
    def invalidate_device(cls, device_id: str) -> None:
        with cls._lock:
            cls._cache.pop(device_id, None)

    @classmethod
    def invalidate_all(cls) -> None:
        with cls._lock:
            cls._cache.clear()
