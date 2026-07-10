export type DeviceStatus = "Online" | "Offline" | "Idle";
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
  currentPlaylistId?: string | null;
  currentMediaId?: string | null;
  ipAddress?: string;
  storage?: string;
  orientation?: DeviceOrientation;
}