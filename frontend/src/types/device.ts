export type DeviceStatus = "Online" | "Idle" | "Offline";
export type DeviceOrientation = "LANDSCAPE" | "PORTRAIT_RIGHT" | "PORTRAIT_LEFT" | "UPSIDE_DOWN";

export interface Device {
  id: string;
  name: string;
  location: string;
  resolution: string;
  status: DeviceStatus;
  lastSeen: string;
  lastSeenMs: number;
  heartbeatAt?: number | null;
  ipAddress?: string | null;
  storage?: string | null;
  appVersion?: string | null;
  currentPlaylistId?: string | null;
  currentMediaId?: string | null;
  storageUsed?: number | null;
  storageTotal?: number | null;
  uptimeSeconds?: number | null;
  firmwareVersion?: string | null;
  orientation?: DeviceOrientation | null;
}

export interface DeviceCreatePayload {
  id: string;
  name: string;
  location: string;
  resolution: string;
  status: DeviceStatus;
  lastSeen: string;
  lastSeenMs: number;
  orientation: DeviceOrientation;
}

export interface DeviceUpdatePayload {
  name?: string;
  location?: string;
  resolution?: string;
  orientation?: DeviceOrientation;
}

export const ORIENTATION_LABELS: Record<DeviceOrientation, string> = {
  LANDSCAPE: "Landscape",
  PORTRAIT_RIGHT: "Portrait (90°)",
  UPSIDE_DOWN: "Upside down (180°)",
  PORTRAIT_LEFT: "Portrait (270°)",
};
