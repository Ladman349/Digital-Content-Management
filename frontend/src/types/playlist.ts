export type PlaylistStatus = "Draft" | "Published" | "Archived";

export interface PlaylistItem {
  id: string;
  mediaId: string;
  duration: number;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  items: PlaylistItem[];
  assignedDeviceIds: string[];
  totalDuration: number;
  status: PlaylistStatus;
  updatedAt: number;
}

export type PlaylistCreatePayload = Omit<Playlist, "id">;
export type PlaylistUpdatePayload = Partial<Omit<Playlist, "id">>;
