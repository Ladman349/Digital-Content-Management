from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.schedule import ScheduleCreate, ScheduleUpdate, ScheduleResponse
from app.core.auth import Principal, get_principal
from app.services.schedule_service import ScheduleService

router = APIRouter(
    prefix="/schedules",
    tags=["Schedules"],
    dependencies=[Depends(get_principal)]
)

@router.get("", response_model=List[ScheduleResponse])
def get_schedules(db: Session = Depends(get_db), principal: Principal = Depends(get_principal)):
    return ScheduleService.get_schedules(db, principal)

@router.get("/{schedule_id}", response_model=ScheduleResponse)
def get_schedule(schedule_id: str, db: Session = Depends(get_db), principal: Principal = Depends(get_principal)):
    schedule = ScheduleService.get_schedule(db, schedule_id, principal)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return schedule

@router.post("", response_model=ScheduleResponse, status_code=status.HTTP_201_CREATED)
def create_schedule(payload: ScheduleCreate, db: Session = Depends(get_db), principal: Principal = Depends(get_principal)):
    return ScheduleService.create_schedule(db, payload, principal)

@router.put("/{schedule_id}", response_model=ScheduleResponse)
def update_schedule(schedule_id: str, payload: ScheduleUpdate, db: Session = Depends(get_db), principal: Principal = Depends(get_principal)):
    schedule = ScheduleService.update_schedule(db, schedule_id, payload, principal)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return schedule

@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_schedule(schedule_id: str, db: Session = Depends(get_db), principal: Principal = Depends(get_principal)):
    success = ScheduleService.delete_schedule(db, schedule_id, principal)
    if not success:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return None
