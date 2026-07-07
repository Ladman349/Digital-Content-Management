import type { Schedule, SortDirection, SortField } from "./types";

const priorityWeight: Record<string, number> = {
  Emergency: 4,
  High: 3,
  Normal: 2,
  Low: 1,
};

export function sortSchedules(
  items: Schedule[],
  field: SortField,
  direction: SortDirection
): Schedule[] {
  return [...items].sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "startDate":
        cmp = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        break;
      case "priority":
        cmp = priorityWeight[a.priority] - priorityWeight[b.priority];
        break;
    }
    return direction === "asc" ? cmp : -cmp;
  });
}

export function hasActiveFilters(search: string, statusFilter: string): boolean {
  return search.trim().length > 0 || statusFilter !== "All";
}

// Basic mock conflict detection: checks if two active schedules overlap on the same device
export function findConflicts(schedules: Schedule[], newSchedule: Schedule): Schedule[] {
  if (newSchedule.status !== "Active") return [];
  
  return schedules.filter(existing => {
    if (existing.id === newSchedule.id) return false;
    if (existing.status !== "Active") return false;
    
    const sharedDevices = existing.deviceIds.some(id => newSchedule.deviceIds.includes(id));
    if (!sharedDevices) return false;

    // Date overlap logic
    const existingStartDate = new Date(existing.startDate).getTime();
    const existingEndDate = new Date(existing.endDate).getTime();
    const newStartDate = new Date(newSchedule.startDate).getTime();
    const newEndDate = new Date(newSchedule.endDate).getTime();

    const dateOverlap = (newStartDate <= existingEndDate && newEndDate >= existingStartDate);
    
    // Time overlap logic
    const existingStart = parseTime(existing.startTime);
    const existingEnd = parseTime(existing.endTime);
    const newStart = parseTime(newSchedule.startTime);
    const newEnd = parseTime(newSchedule.endTime);

    const timeOverlap = (newStart < existingEnd && newEnd > existingStart);
    
    return dateOverlap && timeOverlap;
  });
}

function parseTime(timeStr: string) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}
