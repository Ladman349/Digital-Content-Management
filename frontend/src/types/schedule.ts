export type ScheduleStatus = "Draft" | "Active" | "Paused" | "Expired";

export type ScheduleRepeat = "Once" | "Daily" | "Weekdays" | "Weekends" | "Weekly" | "Monthly";

export type SchedulePriority = "Low" | "Normal" | "High" | "Emergency";

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
}
