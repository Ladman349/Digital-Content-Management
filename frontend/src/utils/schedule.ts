import type { Schedule, SchedulePriority } from "../types/schedule";
import { minutesOfDay, toHHmm } from "./format";

export const PRIORITY_WEIGHT: Record<SchedulePriority, number> = { Emergency: 4, High: 3, Normal: 2, Low: 1 };

function localISODate(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * Mirrors the backend rule: an Active schedule conflicts with another Active schedule when they share a
 * device, their date ranges overlap and their daily time windows overlap. The backend only rejects the
 * save when the new priority is not strictly higher, so every overlap is reported and the UI explains.
 */
export function findConflicts(all: Schedule[], candidate: Schedule): Schedule[] {
  if (candidate.status !== "Active") return [];
  const cStart = minutesOfDay(toHHmm(candidate.startTime));
  const cEnd = minutesOfDay(toHHmm(candidate.endTime));
  return all.filter((s) => {
    if (s.id === candidate.id || s.status !== "Active") return false;
    if (!s.deviceIds.some((d) => candidate.deviceIds.includes(d))) return false;
    const dateOverlap = candidate.startDate <= s.endDate && candidate.endDate >= s.startDate;
    if (!dateOverlap) return false;
    const sStart = minutesOfDay(toHHmm(s.startTime));
    const sEnd = minutesOfDay(toHHmm(s.endTime));
    return cStart < sEnd && cEnd > sStart;
  });
}

export function isScheduleLiveNow(s: Schedule, now = new Date()): boolean {
  if (s.status !== "Active") return false;
  const today = localISODate(now);
  if (s.startDate > today || s.endDate < today) return false;
  const mins = now.getHours() * 60 + now.getMinutes();
  if (mins < minutesOfDay(toHHmm(s.startTime)) || mins > minutesOfDay(toHHmm(s.endTime))) return false;
  const wd = now.getDay(); // 0 = Sunday
  switch (s.repeat) {
    case "Weekdays":
      return wd >= 1 && wd <= 5;
    case "Weekends":
      return wd === 0 || wd === 6;
    case "Weekly":
      return new Date(s.startDate).getDay() === wd;
    case "Monthly":
      return new Date(s.startDate).getDate() === now.getDate();
    default:
      return true;
  }
}

export function isScheduleExpired(s: Schedule, now = new Date()): boolean {
  return s.endDate < localISODate(now);
}
