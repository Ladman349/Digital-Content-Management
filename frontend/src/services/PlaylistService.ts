import { api } from "../api/client";
import type { Playlist, PlaylistCreatePayload, PlaylistUpdatePayload } from "../types/playlist";

export const PlaylistService = {
  list: () => api.get<Playlist[]>("/playlists"),
  create: (data: PlaylistCreatePayload) => api.post<Playlist>("/playlists", data),
  update: (id: string, data: PlaylistUpdatePayload) => api.put<Playlist>(`/playlists/${encodeURIComponent(id)}`, data),
  remove: (id: string) => api.delete(`/playlists/${encodeURIComponent(id)}`),
};
