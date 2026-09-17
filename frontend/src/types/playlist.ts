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
  /** Owning client; null or absent means it belongs to the operator. Only administrators can change it. */
  clientId?: string | null;
}

export type PlaylistCreatePayload = Omit<Playlist, "id">;
export type PlaylistUpdatePayload = Partial<Omit<Playlist, "id">>;
