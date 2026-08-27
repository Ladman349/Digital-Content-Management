from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.device import DeviceCreate, DeviceUpdate, DeviceResponse, HeartbeatRequest, DeviceStatusResponse, DeviceRegisterRequest, DeviceRegisterResponse
from app.services.device_service import DeviceService
from app.services.player_service import PlayerService

router = APIRouter(
    prefix="/devices",
    tags=["Devices"]
)

@router.get("", response_model=List[DeviceResponse])
def get_devices(db: Session = Depends(get_db)):
    return DeviceService.get_devices(db)

@router.post("", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED)
def create_device(payload: DeviceCreate, db: Session = Depends(get_db)):
    return DeviceService.create_device(db, payload)

@router.post("/register", response_model=DeviceRegisterResponse, status_code=status.HTTP_201_CREATED)
def register_device(payload: DeviceRegisterRequest, db: Session = Depends(get_db)):
    return DeviceService.register_device(db, payload)

@router.post("/heartbeat", response_model=DeviceResponse)
def process_heartbeat(payload: HeartbeatRequest, db: Session = Depends(get_db)):
    device = DeviceService.process_heartbeat(db, payload)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device

@router.get("/{device_id}/status", response_model=DeviceStatusResponse)
def get_device_status(device_id: str, db: Session = Depends(get_db)):
    status_response = DeviceService.get_device_status(db, device_id)
    if not status_response:
        raise HTTPException(status_code=404, detail="Device not found")
    return status_response

from fastapi.responses import JSONResponse
from app.core.cache import PlayerCache

@router.get("/{device_id}/current-playlist")
def get_current_playlist(request: Request, device_id: str, db: Session = Depends(get_db)):
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

    # 2. Cache Miss / Expired: Resolve active playlist from database
    scheme = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("x-forwarded-host", request.url.netloc)
    base_url = f"{scheme}://{host}"
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

@router.put("/{device_id}", response_model=DeviceResponse)
def update_device(device_id: str, payload: DeviceUpdate, db: Session = Depends(get_db)):
    device = DeviceService.update_device(db, device_id, payload)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device

@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_device(device_id: str, db: Session = Depends(get_db)):
    success = DeviceService.delete_device(db, device_id)
    if not success:
        raise HTTPException(status_code=404, detail="Device not found")
    return None