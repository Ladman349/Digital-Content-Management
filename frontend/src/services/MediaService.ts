import { api, uploadWithProgress } from "../api/client";
import type { MediaItem, MediaUpdatePayload } from "../types/media";

export const MediaService = {
  list: () => api.get<MediaItem[]>("/media"),
  get: (id: string) => api.get<MediaItem>(`/media/${encodeURIComponent(id)}`),
  upload: (file: File, onProgress?: (fraction: number) => void) => {
    const form = new FormData();
    form.append("file", file, file.name);
    return uploadWithProgress<MediaItem>("/media/upload", form, onProgress);
  },
  update: (id: string, data: MediaUpdatePayload) => api.put<MediaItem>(`/media/${encodeURIComponent(id)}`, data),
  remove: (id: string) => api.delete(`/media/${encodeURIComponent(id)}`),
};
