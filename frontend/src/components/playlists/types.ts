export type { Playlist, PlaylistItem, PlaylistStatus } from "../../types/playlist";
import type { PlaylistStatus } from "../../types/playlist";

export type SortField = "name" | "updatedAt" | "totalDuration";
export type SortDirection = "asc" | "desc";
export type StatusFilter = "All" | PlaylistStatus;
