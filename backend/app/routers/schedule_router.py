from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.schedule import ScheduleCreate, ScheduleUpdate, ScheduleResponse
from app.core.auth import Principal, get_principal
from app.services.schedule_service import ScheduleService
from app.services.audit_service import AuditService, describe_changes

router = APIRouter(
    prefix="/schedules",
    tags=["Schedules"],
    dependencies=[Depends(get_principal)]
)

@router.get("", response_model=List[ScheduleResponse])
def get_schedules(db: Session = Depends(get_db), principal: Principal = Depends(get_principal)):
    return ScheduleService.to_responses(db, ScheduleService.get_schedules(db, principal), principal)

@router.get("/{schedule_id}", response_model=ScheduleResponse)
def get_schedule(schedule_id: str, db: Session = Depends(get_db), principal: Principal = Depends(get_principal)):
    schedule = ScheduleService.get_schedule(db, schedule_id, principal)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return ScheduleService.to_response(db, schedule, principal)

@router.post("", response_model=ScheduleResponse, status_code=status.HTTP_201_CREATED)
def create_schedule(payload: ScheduleCreate, db: Session = Depends(get_db), principal: Principal = Depends(get_principal)):
    schedule = ScheduleService.create_schedule(db, payload, principal)
    AuditService.record(db, principal, "created", "schedule", schedule.id, schedule.name, schedule.clientId, f"{payload.startDate} to {payload.endDate}, {len(payload.deviceIds)} screen(s)")
    return ScheduleService.to_response(db, schedule, principal)

@router.put("/{schedule_id}", response_model=ScheduleResponse)
def update_schedule(schedule_id: str, payload: ScheduleUpdate, db: Session = Depends(get_db), principal: Principal = Depends(get_principal)):
    schedule = ScheduleService.update_schedule(db, schedule_id, payload, principal)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    AuditService.record(db, principal, "updated", "schedule", schedule.id, schedule.name, schedule.clientId, describe_changes(payload.model_dump(exclude_unset=True)))
    return ScheduleService.to_response(db, schedule, principal)

@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_schedule(schedule_id: str, db: Session = Depends(get_db), principal: Principal = Depends(get_principal)):
    doomed = ScheduleService.get_schedule(db, schedule_id, principal)
    label = (doomed.name, doomed.clientId) if doomed else (None, None)
    success = ScheduleService.delete_schedule(db, schedule_id, principal)
    if not success:
        raise HTTPException(status_code=404, detail="Schedule not found")
    AuditService.record(db, principal, "deleted", "schedule", schedule_id, label[0], label[1])
    return None
