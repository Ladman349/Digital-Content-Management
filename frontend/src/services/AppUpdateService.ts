import { api, uploadWithProgress } from "../api/client";
import type { AppUpdate, AppUpdateUploadPayload } from "../types/appUpdate";

export const AppUpdateService = {
  list: () => api.get<AppUpdate[]>("/app-updates/"),
  upload: (payload: AppUpdateUploadPayload, onProgress?: (fraction: number) => void) => {
    const form = new FormData();
    form.append("file", payload.file, payload.file.name);
    form.append("version_name", payload.versionName);
    form.append("version_code", String(payload.versionCode));
    form.append("mandatory", String(payload.mandatory));
    form.append("is_active", String(payload.isActive));
    if (payload.releaseNotes) form.append("release_notes", payload.releaseNotes);
    return uploadWithProgress<AppUpdate>("/app-updates/", form, onProgress);
  },
  activate: (id: string) => api.put<AppUpdate>(`/app-updates/${id}/activate`),
  deactivate: (id: string) => api.put<AppUpdate>(`/app-updates/${id}/deactivate`),
  remove: (id: string) => api.delete(`/app-updates/${id}`),
};
