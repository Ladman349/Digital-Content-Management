import { apiClient } from "../api/apiClient";
import type { Device } from "../types/device";

export const DeviceService = {
  getDevices: async (): Promise<Device[]> => {
    return apiClient.get<Device[]>("/devices");
  },

  createDevice: async (data: Omit<Device, "id">): Promise<Device> => {
    return apiClient.post<Device>("/devices", data);
  },

  updateDevice: async (id: string, data: Partial<Device>): Promise<Device> => {
    return apiClient.put<Device>(`/devices/${id}`, data);
  },

  deleteDevice: async (id: string): Promise<void> => {
    return apiClient.delete(`/devices/${id}`);
  }
};
