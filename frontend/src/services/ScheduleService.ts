import { apiClient } from "../api/apiClient";
import type { Schedule } from "../types/schedule";

export const ScheduleService = {
  getSchedules: async (): Promise<Schedule[]> => {
    return apiClient.get<Schedule[]>("/schedules");
  },

  createSchedule: async (data: Omit<Schedule, "id">): Promise<Schedule> => {
    return apiClient.post<Schedule>("/schedules", data);
  },

  updateSchedule: async (id: string, data: Partial<Schedule>): Promise<Schedule> => {
    return apiClient.put<Schedule>(`/schedules/${id}`, data);
  },

  deleteSchedule: async (id: string): Promise<void> => {
    return apiClient.delete(`/schedules/${id}`);
  }
};
