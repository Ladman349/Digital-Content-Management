import time
from typing import List
from fastapi import HTTPException
from sqlalchemy.orm import Session
import datetime

from app.models.schedule import Schedule
from app.models.schedule_device import ScheduleDevice
from app.models.playlist import Playlist
from app.models.device import Device
from app.schemas.schedule import ScheduleCreate, ScheduleResponse, ScheduleUpdate
from app.core.tenancy import apply_owner_change, ensure_referable, hidden_device_ids, owner_for_new, scope_query, visible

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
        # The player matches startTime <= now <= endTime within a single day, so
        # overnight windows (start >= end) can never be active. Always reject them.
        if start_time >= end_time:
            raise HTTPException(status_code=400, detail="Start time must be before end time.")

    @staticmethod
    def _check_conflicts(db: Session, device_ids: List[str], start_date: datetime.date, end_date: datetime.date, start_time: datetime.time, end_time: datetime.time, priority: str, exclude_schedule_id: str = None, hidden_ids=frozenset()):
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
                        if device_id in hidden_ids:
                            # A screen the caller cannot see: say that there is a clash, not where.
                            raise HTTPException(
                                status_code=400,
                                detail="This schedule also runs on a screen managed by your operator, and the new times clash with another schedule there. Ask your operator to change it."
                            )
                        raise HTTPException(
                            status_code=400, 
                            detail=f"Schedule conflict on device {device_id} with schedule '{existing.name}'. Your priority ({priority}) must be higher than the existing schedule's priority ({existing.priority}) to overlap."
                        )

    @staticmethod
    def _validate_schedule(db: Session, data: dict, exclude_schedule_id: str = None, principal=None, current: Schedule = None):
        if "playlistId" in data:
            playlist = db.query(Playlist).filter(Playlist.id == data["playlistId"]).first()
            # The playlist a schedule already points at is tolerated whoever owns it, so one an
            # administrator chose never makes the schedule uneditable for its client.
            unchanged = current is not None and current.playlistId == data["playlistId"]
            ensure_referable(playlist, None if unchanged else principal, "Referenced Playlist does not exist.")
            if playlist.status != "Published":
                raise HTTPException(status_code=400, detail="Only Published playlists can be scheduled.")
        
        if "deviceIds" in data:
            for d_id in data["deviceIds"]:
                device = db.query(Device).filter(Device.id == d_id).first()
                ensure_referable(device, principal, f"Referenced Device ID {d_id} does not exist.")
        
        if "priority" in data and data["priority"] not in VALID_PRIORITIES:
            raise HTTPException(status_code=400, detail=f"Invalid priority: {data['priority']}")
            
        if "repeat" in data and data["repeat"] not in VALID_REPEATS:
            raise HTTPException(status_code=400, detail=f"Invalid repeat type: {data['repeat']}")

        # For create, all date/time fields exist. For update, we only check if they are provided, but ideally we check the merged state.
        # This function handles the conflict check separately in create/update.

    @staticmethod
    def to_responses(db: Session, schedules, principal=None) -> List[ScheduleResponse]:
        """Serialises schedules, leaving out screens the caller may not see."""
        hidden = hidden_device_ids(db, {d.deviceId for s in schedules for d in s.devices}, principal)
        responses = []
        for schedule in schedules:
            response = ScheduleResponse.model_validate(schedule)
            if hidden:
                response.deviceIds = [d for d in response.deviceIds if d not in hidden]
            responses.append(response)
        return responses

    @staticmethod
    def to_response(db: Session, schedule: Schedule, principal=None) -> ScheduleResponse:
        return ScheduleService.to_responses(db, [schedule], principal)[0]

    @staticmethod
    def get_schedules(db: Session, principal=None) -> List[Schedule]:
        return scope_query(db.query(Schedule), Schedule, principal).all()

    @staticmethod
    def get_schedule(db: Session, schedule_id: str, principal=None) -> Schedule:
        return visible(db.query(Schedule).filter(Schedule.id == schedule_id).first(), principal)

    @staticmethod
    def create_schedule(db: Session, payload: ScheduleCreate, principal=None) -> Schedule:
        ScheduleService._validate_schedule(db, payload.model_dump(), principal=principal)
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
            updatedAt=int(time.time() * 1000),
            clientId=owner_for_new(principal),
        )
        db.add(schedule)
        db.commit()

        for device_id in dict.fromkeys(payload.deviceIds):
            db.add(ScheduleDevice(scheduleId=new_id, deviceId=device_id))

        db.commit()
        db.refresh(schedule)
        from app.core.cache import PlayerCache
        PlayerCache.invalidate_all()
        return schedule

    @staticmethod
    def update_schedule(db: Session, schedule_id: str, payload: ScheduleUpdate, principal=None) -> Schedule:
        schedule = visible(db.query(Schedule).filter(Schedule.id == schedule_id).first(), principal)
        if not schedule:
            return None

        update_data = payload.model_dump(exclude_unset=True)
        apply_owner_change(schedule, update_data, principal, db)
        ScheduleService._validate_schedule(db, update_data, exclude_schedule_id=schedule_id, principal=principal, current=schedule)

        # A client user's list only ever held the screens they can see, so it replaces only those;
        # screens an administrator added from outside their view stay on the schedule.
        hidden = hidden_device_ids(db, schedule.deviceIds, principal)

        # Merge data for validation
        new_start_date = update_data.get("startDate", schedule.startDate)
        new_end_date = update_data.get("endDate", schedule.endDate)
        new_start_time = update_data.get("startTime", schedule.startTime)
        new_end_time = update_data.get("endTime", schedule.endTime)
        new_priority = update_data.get("priority", schedule.priority)
        new_device_ids = schedule.deviceIds
        if "deviceIds" in update_data:
            new_device_ids = list(dict.fromkeys(update_data["deviceIds"])) + sorted(hidden)

        ScheduleService._validate_dates_and_times(new_start_date, new_end_date, new_start_time, new_end_time)
        ScheduleService._check_conflicts(db, new_device_ids, new_start_date, new_end_date, new_start_time, new_end_time, new_priority, exclude_schedule_id=schedule_id, hidden_ids=hidden)

        for key, value in update_data.items():
            if key != "deviceIds":
                setattr(schedule, key, value)
        
        schedule.updatedAt = int(time.time() * 1000)

        if "deviceIds" in update_data:
            stale = db.query(ScheduleDevice).filter(ScheduleDevice.scheduleId == schedule_id)
            if hidden:
                stale = stale.filter(ScheduleDevice.deviceId.notin_(hidden))
            stale.delete(synchronize_session="fetch")
            for device_id in dict.fromkeys(update_data["deviceIds"]):
                db.add(ScheduleDevice(scheduleId=schedule_id, deviceId=device_id))

        db.commit()
        db.refresh(schedule)
        from app.core.cache import PlayerCache
        PlayerCache.invalidate_all()
        return schedule

    @staticmethod
    def delete_schedule(db: Session, schedule_id: str, principal=None) -> bool:
        from fastapi import HTTPException
        from sqlalchemy.exc import IntegrityError
        
        schedule = visible(db.query(Schedule).filter(Schedule.id == schedule_id).first(), principal)
        if not schedule:
            return False
            
        try:
            db.delete(schedule)
            db.commit()
            from app.core.cache import PlayerCache
            PlayerCache.invalidate_all()
            return True
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=409,
                detail="Cannot delete schedule because it is referenced by another entity."
            )
