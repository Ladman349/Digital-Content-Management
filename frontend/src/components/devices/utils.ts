import type { Device, SortDirection, SortField } from "./types";
import { STATUS_ORDER } from "./types";

export function sortDevices(
  devices: Device[],
  field: SortField,
  direction: SortDirection,
): Device[] {
  const sorted = [...devices].sort((a, b) => {
    let cmp = 0;

    switch (field) {
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "location":
        cmp = a.location.localeCompare(b.location);
        break;
      case "status":
        cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        break;
      case "lastSeen":
        cmp = a.lastSeenMs - b.lastSeenMs;
        break;
    }

    return direction === "asc" ? cmp : -cmp;
  });

  return sorted;
}

export function exportDevicesCsv(devices: Device[]) {
  const headers = ["ID", "Name", "Location", "Status", "Resolution", "Last Seen"];
  const rows = devices.map((d) =>
    [d.id, d.name, d.location, d.status, d.resolution, d.lastSeen]
      .map((cell) => `"${cell.replace(/"/g, '""')}"`)
      .join(","),
  );

  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `devices-export-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function hasActiveFilters(
  search: string,
  statusFilter: string,
  locationFilter: string,
): boolean {
  return (
    search.trim().length > 0 ||
    statusFilter !== "All" ||
    locationFilter !== "All"
  );
}
