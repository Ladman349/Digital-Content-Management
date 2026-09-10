import { api } from "../api/client";
import type { Device, DeviceCreatePayload, DeviceUpdatePayload } from "../types/device";

export const DeviceService = {
  list: () => api.get<Device[]>("/devices"),
  create: (data: DeviceCreatePayload) => api.post<Device>("/devices", data),
  update: (id: string, data: DeviceUpdatePayload) => api.put<Device>(`/devices/${encodeURIComponent(id)}`, data),
  remove: (id: string) => api.delete(`/devices/${encodeURIComponent(id)}`),
};
