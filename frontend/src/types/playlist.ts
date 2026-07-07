export type PlaylistStatus = "Draft" | "Published" | "Archived";

export interface PlaylistItem {
  id: string; // Unique ID for the timeline entry
  mediaId: string; // References MediaItem
  duration: number; // Playback duration in seconds
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  items: PlaylistItem[];
  assignedDeviceIds: string[]; // References Device IDs
  totalDuration: number; // Sum of items duration
  status: PlaylistStatus;
  updatedAt: number;
}
