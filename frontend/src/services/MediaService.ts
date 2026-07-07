import { apiClient, API_BASE } from "../api/apiClient";
import type { MediaItem } from "../types/media";

export const MediaService = {
  getMedia: async (): Promise<MediaItem[]> => {
    return apiClient.get<MediaItem[]>("/media");
  },

  getMediaById: async (id: string): Promise<MediaItem> => {
    return apiClient.get<MediaItem>(`/media/${id}`);
  },

  uploadMedia: async (data: Omit<MediaItem, "id">): Promise<MediaItem> => {
    // 1. Fetch the binary data from the local object URL
    const response = await fetch(data.originalFile);
    const blob = await response.blob();
    
    // 2. Wrap it in a File object to retain the name
    const file = new File([blob], data.name, { type: blob.type });

    // 3. Create FormData
    const formData = new FormData();
    formData.append("file", file);

    // 4. Submit as multipart/form-data directly to the real backend
    // Since apiClient.post uses JSON by default, we'll fetch manually for uploads
    const res = await fetch(`${API_BASE}/media/upload`, {
      method: "POST",
      body: formData,
    });
    
    if (!res.ok) {
      throw new Error(`Upload failed: ${res.statusText}`);
    }
    
    return res.json();
  },

  updateMedia: async (id: string, data: Partial<MediaItem>): Promise<MediaItem> => {
    return apiClient.put<MediaItem>(`/media/${id}`, data);
  },

  deleteMedia: async (id: string): Promise<void> => {
    return apiClient.delete(`/media/${id}`);
  }
};
