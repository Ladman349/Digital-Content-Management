import type { SortDirection, SortField, Playlist } from "./types";

export function formatDuration(seconds: number) {
  if (!seconds) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function sortPlaylists(
  items: Playlist[],
  field: SortField,
  direction: SortDirection
): Playlist[] {
  return [...items].sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "updatedAt":
        cmp = a.updatedAt - b.updatedAt;
        break;
      case "totalDuration":
        cmp = a.totalDuration - b.totalDuration;
        break;
    }
    return direction === "asc" ? cmp : -cmp;
  });
}

export function hasActiveFilters(search: string, statusFilter: string): boolean {
  return search.trim().length > 0 || statusFilter !== "All";
}
