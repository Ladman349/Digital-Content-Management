export type { Device, DeviceStatus } from "../../types/device";

import type { DeviceStatus } from "../../types/device";

export interface DeviceFormValues {
  id: string;
  name: string;
  location: string;
  status: DeviceStatus;
  resolution: string;
}

export type StatusFilter = "All" | DeviceStatus;
export type LocationFilter = "All" | string;
export type SortField = "name" | "location" | "status" | "lastSeen";
export type SortDirection = "asc" | "desc";

export const STATUS_ORDER: Record<DeviceStatus, number> = {
  Online: 0,
  Idle: 1,
  Offline: 2,
};
