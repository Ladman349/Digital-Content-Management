import { apiClient } from "../api/apiClient";
import type { Playlist } from "../types/playlist";

export const PlaylistService = {
  getPlaylists: async (): Promise<Playlist[]> => {
    return apiClient.get<Playlist[]>("/playlists");
  },

  createPlaylist: async (data: Omit<Playlist, "id">): Promise<Playlist> => {
    return apiClient.post<Playlist>("/playlists", data);
  },

  updatePlaylist: async (id: string, data: Partial<Playlist>): Promise<Playlist> => {
    return apiClient.put<Playlist>(`/playlists/${id}`, data);
  },

  deletePlaylist: async (id: string): Promise<void> => {
    return apiClient.delete(`/playlists/${id}`);
  }
};
