from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
import threading
import time

from app.database.database import get_db
from app.core.config import settings
from app.core.cache import PlayerCache
from app.schemas.device import DeviceCreate, DeviceUpdate, DeviceResponse, HeartbeatRequest, DeviceStatusResponse, DeviceRegisterRequest, DeviceRegisterResponse
from app.core.auth import Principal, get_principal, require_device, require_device_body
from app.services.device_service import DeviceService
from app.services.player_service import PlayerService
from app.services.audit_service import AuditService, describe_changes
from app.services.report_service import ReportService
from app.schemas.report import PlayBatchRequest, PlayBatchResponse
from app.models.device import Device

router = APIRouter(
    prefix="/devices",
    tags=["Devices"]
)

@router.get("", response_model=List[DeviceResponse])
def get_devices(db: Session = Depends(get_db), principal: Principal = Depends(get_principal)):
    return DeviceService.get_devices(db, principal)

@router.post("", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED)
def create_device(payload: DeviceCreate, db: Session = Depends(get_db), principal: Principal = Depends(get_principal)):
    device = DeviceService.create_device(db, payload, principal)
    AuditService.record(db, principal, "created", "screen", device.id, device.name, device.clientId)
    return device

# Deliberately unauthenticated: this is how a player obtains its token in the first place.
@router.post("/register", response_model=DeviceRegisterResponse, status_code=status.HTTP_201_CREATED)
def register_device(payload: DeviceRegisterRequest, db: Session = Depends(get_db)):
    return DeviceService.register_device(db, payload)

@router.post("/heartbeat", response_model=DeviceResponse)
def process_heartbeat(request: Request, payload: HeartbeatRequest, db: Session = Depends(get_db)):
    # The device id is in the body rather than the path, so this cannot be a path dependency.
    require_device_body(device_id=payload.deviceId, request=request, db=db)
    device = DeviceService.process_heartbeat(db, payload)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device

@router.get("/{device_id}/status", response_model=DeviceStatusResponse, dependencies=[Depends(require_device)])
def get_device_status(device_id: str, db: Session = Depends(get_db)):
    status_response = DeviceService.get_device_status(db, device_id)
    if not status_response:
        raise HTTPException(status_code=404, detail="Device not found")
    return status_response

# Per-device timestamp of the last heartbeat bump performed by the playlist poll.
# Bounded so a flood of unknown/rotating IDs cannot grow it without limit.
_last_seen_cache: dict[str, float] = {}
_last_seen_lock = threading.Lock()
_LAST_SEEN_MAX_ENTRIES = 5000
_LAST_SEEN_BUMP_INTERVAL = 120  # seconds

def _record_last_seen(device_id: str, now: float) -> None:
    with _last_seen_lock:
        if len(_last_seen_cache) > _LAST_SEEN_MAX_ENTRIES:
            stale = [k for k, v in _last_seen_cache.items() if now - v > _LAST_SEEN_BUMP_INTERVAL]
            for k in stale:
                _last_seen_cache.pop(k, None)
            if len(_last_seen_cache) > _LAST_SEEN_MAX_ENTRIES:
                _last_seen_cache.clear()
        _last_seen_cache[device_id] = now

def _forget_last_seen(device_id: str) -> None:
    with _last_seen_lock:
        _last_seen_cache.pop(device_id, None)

@router.get("/{device_id}/current-playlist", dependencies=[Depends(require_device)])
def get_current_playlist(request: Request, device_id: str, db: Session = Depends(get_db)):
    # Record device activity so status is accurately Online on every poll.
    # update_last_seen only touches an existing row; a zero rowcount means the
    # device is unknown, so we answer 404 without inventing heartbeat state.
    current_time = time.time()
    with _last_seen_lock:
        last_bump = _last_seen_cache.get(device_id, 0)
    if current_time - last_bump > _LAST_SEEN_BUMP_INTERVAL:
        if not DeviceService.update_last_seen(db, device_id):
            _forget_last_seen(device_id)
            PlayerCache.invalidate_device(device_id)
            raise HTTPException(status_code=404, detail="Device not found")
        _record_last_seen(device_id, current_time)

    if_none_match = request.headers.get("if-none-match")

    # 1. Fast Path: Serve from in-memory cache if fresh, avoiding Supabase database queries
    cached = PlayerCache.get(device_id)
    if cached is not None:
        result, etag = cached
        if not result:
            return Response(status_code=204)

        if if_none_match:
            clean_inm = if_none_match.strip().strip('"')
            clean_etag = etag.strip('"')
            if clean_inm == clean_etag or if_none_match.strip() == etag:
                return Response(status_code=304, headers={"ETag": etag})

        return JSONResponse(
            content=result.model_dump(),
            headers={"ETag": etag}
        )

    # 2. Cache Miss / Expired: Resolve active playlist from database.
    # Download URLs are built from the configured public base URL, never from
    # client-controlled Host/X-Forwarded-* headers (which would be cached).
    if not DeviceService.get_device(db, device_id):
        _forget_last_seen(device_id)
        raise HTTPException(status_code=404, detail="Device not found")

    base_url = settings.API_BASE_URL.rstrip("/")
    result = PlayerService.get_current_playlist(db, device_id, base_url)
    if not result:
        PlayerCache.set(device_id, None, '""')
        return Response(status_code=204)

    etag = f'"{result.playlistId}_{result.updatedAt}_{result.deviceOrientation}"'
    PlayerCache.set(device_id, result, etag)

    if if_none_match:
        clean_inm = if_none_match.strip().strip('"')
        clean_etag = etag.strip('"')
        if clean_inm == clean_etag or if_none_match.strip() == etag:
            return Response(status_code=304, headers={"ETag": etag})

    return JSONResponse(
        content=result.model_dump(),
        headers={"ETag": etag}
    )

# Proof of play. The player queues what it showed and delivers it here in batches, offline or not.
@router.post("/{device_id}/plays", response_model=PlayBatchResponse)
def record_plays(payload: PlayBatchRequest, device: Device = Depends(require_device), db: Session = Depends(get_db)):
    return ReportService.record_batch(db, device, payload)

@router.get("/{device_id}", response_model=DeviceResponse)
def get_device(device_id: str, db: Session = Depends(get_db), principal: Principal = Depends(get_principal)):
    device = DeviceService.get_device(db, device_id, principal)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device

@router.put("/{device_id}", response_model=DeviceResponse)
def update_device(device_id: str, payload: DeviceUpdate, db: Session = Depends(get_db), principal: Principal = Depends(get_principal)):
    device = DeviceService.update_device(db, device_id, payload, principal)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    AuditService.record(db, principal, "updated", "screen", device.id, device.name, device.clientId, describe_changes(payload.model_dump(exclude_unset=True)))
    return device

@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_device(device_id: str, db: Session = Depends(get_db), principal: Principal = Depends(get_principal)):
    doomed = DeviceService.get_device(db, device_id, principal)
    label = (doomed.name, doomed.clientId) if doomed else (None, None)
    success = DeviceService.delete_device(db, device_id, principal)
    if not success:
        raise HTTPException(status_code=404, detail="Device not found")
    _forget_last_seen(device_id)
    AuditService.record(db, principal, "deleted", "screen", device_id, label[0], label[1])
    return None
