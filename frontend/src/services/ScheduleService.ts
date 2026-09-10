import { api } from "../api/client";
import type { Schedule, ScheduleCreatePayload, ScheduleUpdatePayload } from "../types/schedule";
import { toHHmm } from "../utils/format";

function normalise(s: Schedule): Schedule {
  return { ...s, startTime: toHHmm(s.startTime), endTime: toHHmm(s.endTime) };
}

export const ScheduleService = {
  list: async () => (await api.get<Schedule[]>("/schedules")).map(normalise),
  create: async (data: ScheduleCreatePayload) => normalise(await api.post<Schedule>("/schedules", data)),
  update: async (id: string, data: ScheduleUpdatePayload) => normalise(await api.put<Schedule>(`/schedules/${encodeURIComponent(id)}`, data)),
  remove: (id: string) => api.delete(`/schedules/${encodeURIComponent(id)}`),
};
