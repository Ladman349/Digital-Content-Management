export type ScheduleStatus = "Draft" | "Active" | "Paused" | "Expired";
export type ScheduleRepeat = "Once" | "Daily" | "Weekdays" | "Weekends" | "Weekly" | "Monthly";
export type SchedulePriority = "Low" | "Normal" | "High" | "Emergency";

export const SCHEDULE_REPEATS: ScheduleRepeat[] = ["Once", "Daily", "Weekdays", "Weekends", "Weekly", "Monthly"];
export const SCHEDULE_PRIORITIES: SchedulePriority[] = ["Emergency", "High", "Normal", "Low"];

export interface Schedule {
  id: string;
  name: string;
  playlistId: string;
  deviceIds: string[];
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  repeat: ScheduleRepeat;
  priority: SchedulePriority;
  status: ScheduleStatus;
  createdAt?: number;
  updatedAt?: number;
  /** Owning client; null or absent means it belongs to the operator. Only administrators can change it. */
  clientId?: string | null;
}

export type ScheduleCreatePayload = Omit<Schedule, "id" | "createdAt" | "updatedAt">;
export type ScheduleUpdatePayload = Partial<ScheduleCreatePayload>;
