export type DeviceStatus = "Online" | "Offline" | "Idle";

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
}