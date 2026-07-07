import type { SortDirection, SortField, MediaItem } from "./types";

export function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatDuration(seconds?: number) {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function sortMedia(
  items: MediaItem[],
  field: SortField,
  direction: SortDirection
): MediaItem[] {
  return [...items].sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "uploadedAt":
        cmp = a.uploadedAt - b.uploadedAt;
        break;
      case "size":
        cmp = a.size - b.size;
        break;
    }
    return direction === "asc" ? cmp : -cmp;
  });
}

export function hasActiveFilters(search: string, typeFilter: string, categoryFilter: string): boolean {
  return search.trim().length > 0 || typeFilter !== "All" || categoryFilter !== "All";
}
