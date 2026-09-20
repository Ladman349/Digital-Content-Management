import { api, fetchBlob } from "../api/client";
import type { Device, DeviceCreatePayload, DeviceUpdatePayload } from "../types/device";

export const DeviceService = {
  list: () => api.get<Device[]>("/devices"),
  create: (data: DeviceCreatePayload) => api.post<Device>("/devices", data),
  update: (id: string, data: DeviceUpdatePayload) => api.put<Device>(`/devices/${encodeURIComponent(id)}`, data),
  remove: (id: string) => api.delete(`/devices/${encodeURIComponent(id)}`),
  /** Asks the screen for a picture of what it is showing; it answers on its next heartbeat. */
  requestScreenshot: (id: string) => api.post<Device>(`/devices/${encodeURIComponent(id)}/screenshot/request`),
  screenshot: (id: string) => fetchBlob(`/devices/${encodeURIComponent(id)}/screenshot`),
};
