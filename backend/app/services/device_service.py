import uuid
import time
from typing import List
from sqlalchemy.orm import Session
from app.models.device import Device
from app.schemas.device import DeviceCreate, DeviceUpdate, HeartbeatRequest, DeviceStatusResponse, DeviceRegisterRequest, DeviceRegisterResponse
from datetime import datetime

class DeviceService:

    @staticmethod
    def get_devices(db: Session) -> List[Device]:
        return db.query(Device).all()

    @staticmethod
    def get_device(db: Session, device_id: str) -> Device:
        return db.query(Device).filter(Device.id == device_id).first()

    @staticmethod
    def create_device(db: Session, payload: DeviceCreate) -> Device:
        from fastapi import HTTPException
        
        # Verify Device ID uniqueness
        if db.query(Device).filter(Device.id == payload.id).first():
            raise HTTPException(
                status_code=409,
                detail="A device with this Device ID already exists."
            )
            
        device = Device(
            **payload.model_dump()
        )
        db.add(device)
        db.commit()
        db.refresh(device)
        return device

    @staticmethod
    def update_device(db: Session, device_id: str, payload: DeviceUpdate) -> Device:
        device = db.query(Device).filter(Device.id == device_id).first()
        if not device:
            return None
        
        update_data = payload.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(device, key, value)
            
        db.commit()
        db.refresh(device)
        return device

    @staticmethod
    def delete_device(db: Session, device_id: str) -> bool:
        from fastapi import HTTPException
        from sqlalchemy.exc import IntegrityError
        
        device = db.query(Device).filter(Device.id == device_id).first()
        if not device:
            return False
            
        try:
            db.delete(device)
            db.commit()
            return True
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=409,
                detail="Cannot delete device because it is assigned to one or more schedules or playlists."
            )

    @staticmethod
    def calculate_status(heartbeat_at: int) -> str:
        if not heartbeat_at:
            return "Offline"
        
        current_time = int(time.time() * 1000)
        elapsed_seconds = (current_time - heartbeat_at) / 1000

        if elapsed_seconds < 60:
            return "Online"
        elif elapsed_seconds <= 300:
            return "Idle"
        else:
            return "Offline"

    @staticmethod
    def process_heartbeat(db: Session, payload: HeartbeatRequest) -> Device:
        device = db.query(Device).filter(Device.id == payload.deviceId).first()
        if not device:
            return None
        
        current_time = int(time.time() * 1000)
        
        device.heartbeatAt = current_time
        device.lastSeen = "now"
        device.lastSeenMs = current_time
        
        if payload.storageUsed is not None and payload.storageTotal is not None:
            device.storageUsed = payload.storageUsed
            device.storageTotal = payload.storageTotal
            # Optional: update the string storage field for backwards compatibility
            device.storage = f"{payload.storageTotal}GB"
            
        if payload.currentPlaylistId is not None:
            device.currentPlaylistId = payload.currentPlaylistId
        if payload.currentMediaId is not None:
            device.currentMediaId = payload.currentMediaId
        if payload.appVersion is not None:
            device.appVersion = payload.appVersion
        if payload.uptimeSeconds is not None:
            device.uptimeSeconds = payload.uptimeSeconds
        if payload.ipAddress is not None:
            device.ipAddress = payload.ipAddress
        if payload.firmwareVersion is not None:
            device.firmwareVersion = payload.firmwareVersion
            
        device.status = "Online"
        
        db.commit()
        db.refresh(device)
        return device

    @staticmethod
    def register_device(db: Session, payload: DeviceRegisterRequest) -> DeviceRegisterResponse:
        if payload.androidId:
            existing = db.query(Device).filter(Device.androidId == payload.androidId).first()
            if existing:
                # Generate a token if it's an old device without one
                if not existing.deviceToken:
                    existing.deviceToken = uuid.uuid4().hex
                    db.commit()
                return DeviceRegisterResponse(
                    deviceId=existing.id,
                    deviceToken=existing.deviceToken,
                    backendTime=datetime.utcnow().isoformat() + "Z"
                )
        
        new_id = f"TV-{uuid.uuid4().hex[:8].upper()}"
        device_token = uuid.uuid4().hex
        current_time = int(time.time() * 1000)
        
        device = Device(
            id=new_id,
            name=payload.name,
            location="Unassigned",
            resolution=payload.resolution,
            status="Online",
            lastSeen="now",
            lastSeenMs=current_time,
            ipAddress=payload.ipAddress,
            appVersion=payload.appVersion,
            androidId=payload.androidId,
            deviceToken=device_token,
            heartbeatAt=current_time
        )
        db.add(device)
        db.commit()
        
        return DeviceRegisterResponse(
            deviceId=device.id,
            deviceToken=device.deviceToken,
            backendTime=datetime.utcnow().isoformat() + "Z"
        )

    @staticmethod
    def get_device_status(db: Session, device_id: str) -> DeviceStatusResponse:
        device = db.query(Device).filter(Device.id == device_id).first()
        if not device:
            return None
            
        calculated_status = DeviceService.calculate_status(device.heartbeatAt)
        
        return DeviceStatusResponse(
            status=calculated_status,
            lastSeen=device.lastSeen,
            heartbeatAt=device.heartbeatAt,
            storage=device.storage,
            currentPlaylistId=device.currentPlaylistId,
            currentMediaId=device.currentMediaId
        )