import time
from typing import List
from fastapi import HTTPException
from sqlalchemy.orm import Session
import datetime

from app.models.schedule import Schedule
from app.models.schedule_device import ScheduleDevice
from app.models.playlist import Playlist
from app.models.device import Device
from app.schemas.schedule import ScheduleCreate, ScheduleUpdate

PRIORITY_LEVELS = {
    "Emergency": 4,
    "High": 3,
    "Normal": 2,
    "Low": 1
}

VALID_REPEATS = {"Once", "Daily", "Weekdays", "Weekends", "Weekly", "Monthly"}
VALID_PRIORITIES = set(PRIORITY_LEVELS.keys())

class ScheduleService:

    @staticmethod
    def _validate_dates_and_times(start_date: datetime.date, end_date: datetime.date, start_time: datetime.time, end_time: datetime.time):
        if start_date > end_date:
            raise HTTPException(status_code=400, detail="Start date cannot be after end date.")
        if start_date == end_date and start_time >= end_time:
            raise HTTPException(status_code=400, detail="Start time must be before end time on the same day.")

    @staticmethod
    def _check_conflicts(db: Session, device_ids: List[str], start_date: datetime.date, end_date: datetime.date, start_time: datetime.time, end_time: datetime.time, priority: str, exclude_schedule_id: str = None):
        new_priority_level = PRIORITY_LEVELS.get(priority, 0)
        
        # Get all schedules that target these devices
        for device_id in device_ids:
            device_schedules = db.query(Schedule).join(ScheduleDevice).filter(
                ScheduleDevice.deviceId == device_id,
                Schedule.status == "Active"
            ).all()
            for existing in device_schedules:
                if exclude_schedule_id and existing.id == exclude_schedule_id:
                    continue
                
                # Check Date Overlap
                date_overlap = (start_date <= existing.endDate) and (end_date >= existing.startDate)
                # Check Time Overlap
                time_overlap = (start_time < existing.endTime) and (end_time > existing.startTime)
                
                if date_overlap and time_overlap:
                    existing_priority_level = PRIORITY_LEVELS.get(existing.priority, 0)
                    if new_priority_level <= existing_priority_level:
                        raise HTTPException(
                            status_code=400, 
                            detail=f"Schedule conflict on device {device_id} with schedule '{existing.name}'. Your priority ({priority}) must be higher than the existing schedule's priority ({existing.priority}) to overlap."
                        )

    @staticmethod
    def _validate_schedule(db: Session, data: dict, exclude_schedule_id: str = None):
        if "playlistId" in data:
            playlist = db.query(Playlist).filter(Playlist.id == data["playlistId"]).first()
            if not playlist:
                raise HTTPException(status_code=400, detail="Referenced Playlist does not exist.")
            if playlist.status != "Published":
                raise HTTPException(status_code=400, detail="Only Published playlists can be scheduled.")
        
        if "deviceIds" in data:
            for d_id in data["deviceIds"]:
                if not db.query(Device).filter(Device.id == d_id).first():
                    raise HTTPException(status_code=400, detail=f"Referenced Device ID {d_id} does not exist.")
        
        if "priority" in data and data["priority"] not in VALID_PRIORITIES:
            raise HTTPException(status_code=400, detail=f"Invalid priority: {data['priority']}")
            
        if "repeat" in data and data["repeat"] not in VALID_REPEATS:
            raise HTTPException(status_code=400, detail=f"Invalid repeat type: {data['repeat']}")

        # For create, all date/time fields exist. For update, we only check if they are provided, but ideally we check the merged state.
        # This function handles the conflict check separately in create/update.

    @staticmethod
    def get_schedules(db: Session) -> List[Schedule]:
        return db.query(Schedule).all()

    @staticmethod
    def get_schedule(db: Session, schedule_id: str) -> Schedule:
        return db.query(Schedule).filter(Schedule.id == schedule_id).first()

    @staticmethod
    def create_schedule(db: Session, payload: ScheduleCreate) -> Schedule:
        ScheduleService._validate_schedule(db, payload.model_dump())
        ScheduleService._validate_dates_and_times(payload.startDate, payload.endDate, payload.startTime, payload.endTime)
        ScheduleService._check_conflicts(db, payload.deviceIds, payload.startDate, payload.endDate, payload.startTime, payload.endTime, payload.priority)

        new_id = f"SCH-NEW-{int(time.time() * 1000)}"
        schedule = Schedule(
            id=new_id,
            name=payload.name,
            playlistId=payload.playlistId,
            startDate=payload.startDate,
            endDate=payload.endDate,
            startTime=payload.startTime,
            endTime=payload.endTime,
            repeat=payload.repeat,
            priority=payload.priority,
            status=payload.status,
            createdAt=int(time.time() * 1000),
            updatedAt=int(time.time() * 1000)
        )
        db.add(schedule)
        db.commit()

        for device_id in payload.deviceIds:
            db.add(ScheduleDevice(scheduleId=new_id, deviceId=device_id))
        
        db.commit()
        db.refresh(schedule)
        return schedule

    @staticmethod
    def update_schedule(db: Session, schedule_id: str, payload: ScheduleUpdate) -> Schedule:
        schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
        if not schedule:
            return None

        update_data = payload.model_dump(exclude_unset=True)
        ScheduleService._validate_schedule(db, update_data, exclude_schedule_id=schedule_id)
        
        # Merge data for validation
        new_start_date = update_data.get("startDate", schedule.startDate)
        new_end_date = update_data.get("endDate", schedule.endDate)
        new_start_time = update_data.get("startTime", schedule.startTime)
        new_end_time = update_data.get("endTime", schedule.endTime)
        new_priority = update_data.get("priority", schedule.priority)
        new_device_ids = update_data.get("deviceIds", schedule.deviceIds)

        ScheduleService._validate_dates_and_times(new_start_date, new_end_date, new_start_time, new_end_time)
        ScheduleService._check_conflicts(db, new_device_ids, new_start_date, new_end_date, new_start_time, new_end_time, new_priority, exclude_schedule_id=schedule_id)

        for key, value in update_data.items():
            if key != "deviceIds":
                setattr(schedule, key, value)
        
        schedule.updatedAt = int(time.time() * 1000)

        if "deviceIds" in update_data:
            db.query(ScheduleDevice).filter(ScheduleDevice.scheduleId == schedule_id).delete()
            for device_id in update_data["deviceIds"]:
                db.add(ScheduleDevice(scheduleId=schedule_id, deviceId=device_id))

        db.commit()
        db.refresh(schedule)
        return schedule

    @staticmethod
    def delete_schedule(db: Session, schedule_id: str) -> bool:
        from fastapi import HTTPException
        from sqlalchemy.exc import IntegrityError
        
        schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
        if not schedule:
            return False
            
        try:
            db.delete(schedule)
            db.commit()
            return True
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=409,
                detail="Cannot delete schedule because it is referenced by another entity."
            )
