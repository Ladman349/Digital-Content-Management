import { useCallback, useMemo, useState } from "react";
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, LinearProgress, ListItemIcon, ListItemText, Menu, MenuItem, TextField, Tooltip, Typography } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import TvRoundedIcon from "@mui/icons-material/TvRounded";
import FilterListOffRoundedIcon from "@mui/icons-material/FilterListOffRounded";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import PlaylistPlayRoundedIcon from "@mui/icons-material/PlaylistPlayRounded";
import { useSnackbar } from "notistack";

import PageHeader from "../../components/ui/PageHeader";
import SearchField from "../../components/ui/SearchField";
import SegmentedFilter from "../../components/ui/SegmentedFilter";
import FilterSelect from "../../components/ui/FilterSelect";
import DataTable, { type Column, type SortState } from "../../components/ui/DataTable";
import EmptyState from "../../components/ui/EmptyState";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import BulkBar from "../../components/ui/BulkBar";
import StatusChip from "../../components/ui/StatusChip";
import RowLead from "../../components/ui/RowLead";
import { deviceTone } from "../../components/ui/tone";
import DeviceDetailPanel from "./DeviceDetailPanel";
import DeviceFormDialog, { type DeviceFormValues } from "./DeviceFormDialog";

import { useAssignPlaylistToDevices, useCreateDevice, useDeleteDevices, useDevices, usePlaylists, useSchedules, useUpdateDevice } from "../../hooks/queries";
import { useFilterParam, useSelectParam } from "../../hooks/useSelectParam";
import { useNow } from "../../hooks/useNow";
import { usePlaybackMap } from "../../hooks/usePlayback";
import type { Device, DeviceStatus } from "../../types/device";
import { ORIENTATION_LABELS } from "../../types/device";
import { formatDateTime, formatMegabytes, relativeTime } from "../../utils/format";

type StatusFilter = "All" | DeviceStatus;
const STATUS_RANK: Record<DeviceStatus, number> = { Online: 0, Idle: 1, Offline: 2 };

export default function DevicesPage() {
  const { enqueueSnackbar } = useSnackbar();
  const now = useNow(15_000);

  const { data: devices = [], isLoading } = useDevices();
  const { data: playlists = [] } = usePlaylists();
  const { data: schedules = [] } = useSchedules();
  const createDevice = useCreateDevice();
  const updateDevice = useUpdateDevice();
  const deleteDevices = useDeleteDevices();
  const assignPlaylist = useAssignPlaylistToDevices();

  const playback = usePlaybackMap(devices, playlists, schedules, now);

  // ── filters / sort / selection ────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useFilterParam("status", "All");
  const [locationFilter, setLocationFilter] = useFilterParam("location", "All");
  const [sort, setSort] = useState<SortState>({ key: "status", direction: "asc" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useSelectParam();

  // ── dialogs ───────────────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignValue, setAssignValue] = useState("");
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationValue, setLocationValue] = useState("");
  const [menu, setMenu] = useState<{ anchor: HTMLElement; device: Device } | null>(null);

  const locations = useMemo(() => [...new Set(devices.map((d) => d.location))].sort(), [devices]);
  const counts = useMemo(
    () => ({
      All: devices.length,
      Online: devices.filter((d) => d.status === "Online").length,
      Idle: devices.filter((d) => d.status === "Idle").length,
      Offline: devices.filter((d) => d.status === "Offline").length,
    }),
    [devices],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = devices;
    if (q) list = list.filter((d) => [d.name, d.id, d.location, d.ipAddress ?? "", d.appVersion ?? ""].some((v) => v.toLowerCase().includes(q)));
    if (statusFilter !== "All") list = list.filter((d) => d.status === statusFilter);
    if (locationFilter !== "All") list = list.filter((d) => d.location === locationFilter);
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      switch (sort.key) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "location":
          return a.location.localeCompare(b.location) * dir;
        case "lastSeen":
          return ((a.heartbeatAt ?? a.lastSeenMs) - (b.heartbeatAt ?? b.lastSeenMs)) * dir;
        case "playing":
          return (playback.get(a.id)?.effective?.name ?? "").localeCompare(playback.get(b.id)?.effective?.name ?? "") * dir;
        case "status":
        default: {
          const s = STATUS_RANK[a.status] - STATUS_RANK[b.status];
          return (s !== 0 ? s : a.name.localeCompare(b.name)) * dir;
        }
      }
    });
  }, [devices, search, statusFilter, locationFilter, sort, playback]);

  const selectedDevice = useMemo(() => devices.find((d) => d.id === selectedId) ?? null, [devices, selectedId]);
  const selectedIndex = rows.findIndex((d) => d.id === selectedId);
  const filtersActive = Boolean(search.trim()) || statusFilter !== "All" || locationFilter !== "All";

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("All");
    setLocationFilter("All");
  };

  // ── actions ───────────────────────────────────────────────────────────────
  const copyId = useCallback(
    async (id: string) => {
      try {
        await navigator.clipboard.writeText(id);
        enqueueSnackbar("Device ID copied", { variant: "info" });
      } catch {
        enqueueSnackbar("Clipboard unavailable", { variant: "warning" });
      }
    },
    [enqueueSnackbar],
  );

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (d: Device) => {
    setEditing(d);
    setFormOpen(true);
  };

  const submitForm = async (values: DeviceFormValues) => {
    try {
      if (editing) {
        await updateDevice.mutateAsync({ id: editing.id, data: { name: values.name, location: values.location, resolution: values.resolution, orientation: values.orientation } });
        enqueueSnackbar("Device updated", { variant: "success" });
      } else {
        await createDevice.mutateAsync({ ...values, status: "Offline", lastSeen: "never", lastSeenMs: 0 });
        enqueueSnackbar(`Device “${values.name}” added`, { variant: "success" });
        setSelectedId(values.id);
      }
      setFormOpen(false);
    } catch (e) {
      enqueueSnackbar((e as Error).message, { variant: "error" });
    }
  };

  const confirmDelete = async () => {
    if (!deleteIds) return;
    try {
      const result = await deleteDevices.mutateAsync(deleteIds);
      if (result.failed.length) enqueueSnackbar(`${result.ok.length} deleted, ${result.failed.length} failed: ${result.failed[0].error}`, { variant: "warning" });
      else enqueueSnackbar(`${result.ok.length} device${result.ok.length === 1 ? "" : "s"} deleted`, { variant: "success" });
      setSelected((s) => {
        const next = new Set(s);
        result.ok.forEach((id) => next.delete(id));
        return next;
      });
      if (selectedId && result.ok.includes(selectedId)) setSelectedId(null);
    } catch (e) {
      enqueueSnackbar((e as Error).message, { variant: "error" });
    } finally {
      setDeleteIds(null);
    }
  };

  const bulkAssign = async () => {
    try {
      await assignPlaylist.mutateAsync({ playlistId: assignValue || null, deviceIds: [...selected] });
      enqueueSnackbar(assignValue ? `Playlist assigned to ${selected.size} device${selected.size === 1 ? "" : "s"}` : "Assignments cleared", { variant: "success" });
      setAssignOpen(false);
    } catch (e) {
      enqueueSnackbar((e as Error).message, { variant: "error" });
    }
  };

  const bulkLocation = async () => {
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map((id) => updateDevice.mutateAsync({ id, data: { location: locationValue.trim() } })));
    const failed = results.filter((r) => r.status === "rejected").length;
    enqueueSnackbar(failed ? `${ids.length - failed} updated, ${failed} failed` : `Location set on ${ids.length} device${ids.length === 1 ? "" : "s"}`, { variant: failed ? "warning" : "success" });
    setLocationOpen(false);
  };

  // ── columns ───────────────────────────────────────────────────────────────
  const columns: Column<Device>[] = [
    {
      key: "status",
      label: "Status",
      width: 110,
      sortable: true,
      onCard: true,
      render: (d) => <StatusChip label={d.status} tone={deviceTone(d.status)} pulse={d.status === "Online"} />,
    },
    {
      key: "name",
      label: "Screen",
      sortable: true,
      render: (d) => <RowLead name={d.name} sub={d.id} title={d.name} />,
    },
    {
      key: "location",
      label: "Location",
      sortable: true,
      hideBelow: "md",
      render: (d) => <Typography sx={{ fontSize: 13 }}>{d.location}</Typography>,
    },
    {
      key: "playing",
      label: "Showing",
      sortable: true,
      hideBelow: "sm",
      onCard: true,
      render: (d) => {
        const p = playback.get(d.id);
        if (!p?.effective)
          return (
            <Typography sx={{ fontSize: 15, fontWeight: 600, textTransform: "uppercase", color: "text.disabled" }}>
              — nothing —
            </Typography>
          );
        return (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 600, textTransform: "uppercase", color: "primary.main" }} noWrap>
              {p.effective.name}
            </Typography>
            {p.liveSchedule && <Chip label="scheduled" variant="outlined" sx={{ height: 18, fontSize: 10.5 }} />}
            {p.mismatch && (
              <Tooltip title={`Device reports “${p.reported?.name ?? d.currentPlaylistId ?? "nothing"}”`}>
                <Chip label="out of sync" color="warning" variant="outlined" sx={{ height: 18, fontSize: 10.5 }} />
              </Tooltip>
            )}
          </Box>
        );
      },
    },
    {
      key: "display",
      label: "Display",
      hideBelow: "lg",
      render: (d) => (
        <Typography variant="body2" color="text.secondary" noWrap>
          {d.resolution}
          {d.orientation && d.orientation !== "LANDSCAPE" ? ` · ${ORIENTATION_LABELS[d.orientation]}` : ""}
        </Typography>
      ),
    },
    {
      key: "storage",
      label: "Storage",
      width: 120,
      hideBelow: "lg",
      render: (d) => {
        if (!d.storageUsed || !d.storageTotal)
          return (
            <Typography variant="body2" color="text.disabled">
              —
            </Typography>
          );
        const pct = Math.min(100, (d.storageUsed / d.storageTotal) * 100);
        return (
          <Tooltip title={`${formatMegabytes(d.storageUsed)} of ${formatMegabytes(d.storageTotal)} used`}>
            <Box>
              <LinearProgress variant="determinate" value={pct} color={pct > 90 ? "error" : "primary"} sx={{ height: 5 }} />
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.4 }}>
                {Math.round(pct)}% used
              </Typography>
            </Box>
          </Tooltip>
        );
      },
    },
    {
      key: "app",
      label: "App",
      hideBelow: "lg",
      render: (d) => (
        <Typography variant="caption" color="text.secondary" noWrap>
          {d.appVersion?.split(" ")[0] || "—"}
        </Typography>
      ),
    },
    {
      key: "lastSeen",
      label: "Last seen",
      sortable: true,
      width: 110,
      onCard: true,
      render: (d) => (
        <Tooltip title={formatDateTime(d.heartbeatAt ?? d.lastSeenMs)}>
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
            {relativeTime(d.heartbeatAt ?? d.lastSeenMs, now)}
          </Typography>
        </Tooltip>
      ),
    },
    {
      key: "actions",
      label: "",
      width: 44,
      align: "right",
      render: (d) => (
        <IconButton
          aria-label={`Actions for ${d.name}`}
          onClick={(e) => {
            e.stopPropagation();
            setMenu({ anchor: e.currentTarget, device: d });
          }}
        >
          <MoreHorizRoundedIcon fontSize="small" />
        </IconButton>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Devices"
        meta={
          !isLoading && (
            <>
              <span>{counts.All} total</span>
              <span>·</span>
              <Box component="span" sx={{ color: "success.main", fontWeight: 600 }}>
                {counts.Online} online
              </Box>
              {counts.Offline > 0 && (
                <>
                  <span>·</span>
                  <Box component="span" sx={{ color: "error.main", fontWeight: 600 }}>
                    {counts.Offline} offline
                  </Box>
                </>
              )}
            </>
          )
        }
        actions={
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openAdd}>
            Add device
          </Button>
        }
      >
        <SearchField value={search} onChange={setSearch} placeholder="Search name, ID, location, IP…" />
        <SegmentedFilter<StatusFilter>
          ariaLabel="Filter by status"
          value={statusFilter as StatusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "All", label: "All", count: counts.All },
            { value: "Online", label: "Online", count: counts.Online },
            { value: "Idle", label: "Idle", count: counts.Idle },
            { value: "Offline", label: "Offline", count: counts.Offline },
          ]}
        />
        {locations.length > 1 && <FilterSelect label="Location" value={locationFilter} onChange={setLocationFilter} options={[{ value: "All", label: "All locations" }, ...locations.map((l) => ({ value: l, label: l }))]} width={170} />}
        {filtersActive && (
          <Button size="small" onClick={clearFilters} startIcon={<FilterListOffRoundedIcon />}>
            Clear
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Typography variant="body2" color="text.secondary">
          {rows.length === devices.length ? `${rows.length} devices` : `${rows.length} of ${devices.length}`}
        </Typography>
      </PageHeader>

      <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <DataTable<Device>
            columns={columns}
            rows={rows}
            rowKey={(d) => d.id}
            loading={isLoading}
            selectable
            selected={selected}
            onSelectionChange={setSelected}
            onRowClick={(d) => setSelectedId(d.id === selectedId ? null : d.id)}
            activeRowKey={selectedId}
            sort={sort}
            onSortChange={setSort}
            rowHighlight={(d) => (playback.get(d.id)?.mismatch ? "warning" : undefined)}
            emptyState={
              filtersActive ? (
                <EmptyState icon={FilterListOffRoundedIcon} title="No devices match" description="Try a different search or clear the filters." actionLabel="Clear filters" onAction={clearFilters} />
              ) : (
                <EmptyState
                  icon={TvRoundedIcon}
                  title="No devices yet"
                  description="Install the player app on a TV. It registers itself and shows up here within a minute. You can also add a placeholder manually."
                  actionLabel="Add device manually"
                  onAction={openAdd}
                />
              )
            }
          />
          <BulkBar count={selected.size} noun="device" onClear={() => setSelected(new Set())} onSelectAll={() => setSelected(new Set(rows.map((d) => d.id)))} total={rows.length}>
            <Button
              variant="outlined"
              onClick={() => {
                setAssignValue("");
                setAssignOpen(true);
              }}
            >
              Assign playlist
            </Button>
            <Button
              variant="outlined"
              startIcon={<PlaceOutlinedIcon />}
              onClick={() => {
                setLocationValue("");
                setLocationOpen(true);
              }}
            >
              Set location
            </Button>
            <Button variant="outlined" color="error" startIcon={<DeleteOutlineRoundedIcon />} onClick={() => setDeleteIds([...selected])}>
              Delete
            </Button>
          </BulkBar>
        </Box>

        <DeviceDetailPanel
          device={selectedDevice}
          playback={selectedDevice ? playback.get(selectedDevice.id) : undefined}
          playlists={playlists}
          schedules={schedules}
          now={now}
          onClose={() => setSelectedId(null)}
          onPrev={selectedIndex > 0 ? () => setSelectedId(rows[selectedIndex - 1].id) : undefined}
          onNext={selectedIndex >= 0 && selectedIndex < rows.length - 1 ? () => setSelectedId(rows[selectedIndex + 1].id) : undefined}
          position={selectedIndex >= 0 ? `${selectedIndex + 1} / ${rows.length}` : undefined}
          onEdit={openEdit}
          onDelete={(d) => setDeleteIds([d.id])}
        />
      </Box>

      {/* Row menu */}
      <Menu anchorEl={menu?.anchor} open={Boolean(menu)} onClose={() => setMenu(null)}>
        <MenuItem
          onClick={() => {
            if (menu) openEdit(menu.device);
            setMenu(null);
          }}
        >
          <ListItemIcon>
            <EditOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menu) {
              setSelected(new Set([menu.device.id]));
              setAssignValue(playback.get(menu.device.id)?.assigned?.id ?? "");
              setAssignOpen(true);
            }
            setMenu(null);
          }}
        >
          <ListItemIcon>
            <PlaylistPlayRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Assign playlist</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menu) copyId(menu.device.id);
            setMenu(null);
          }}
        >
          <ListItemIcon>
            <ContentCopyRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Copy device ID</ListItemText>
        </MenuItem>
        <MenuItem
          sx={{ color: "error.main" }}
          onClick={() => {
            if (menu) setDeleteIds([menu.device.id]);
            setMenu(null);
          }}
        >
          <ListItemIcon>
            <DeleteOutlineRoundedIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      <DeviceFormDialog open={formOpen} device={editing} saving={createDevice.isPending || updateDevice.isPending} onClose={() => setFormOpen(false)} onSubmit={submitForm} />

      <ConfirmDialog
        open={Boolean(deleteIds)}
        title={deleteIds && deleteIds.length > 1 ? `Delete ${deleteIds.length} devices?` : "Delete device?"}
        message={
          deleteIds && deleteIds.length === 1
            ? `“${devices.find((d) => d.id === deleteIds[0])?.name ?? deleteIds[0]}” will be removed from the CMS. The player will re-register with a new ID the next time it starts.`
            : "The selected devices will be removed from the CMS. Players re-register with new IDs the next time they start."
        }
        loading={deleteDevices.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleteIds(null)}
      />

      <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Assign playlist to {selected.size === 1 ? "device" : `${selected.size} devices`}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            The direct assignment plays whenever no schedule is live. Choosing a playlist replaces any previous assignment on these devices.
          </Typography>
          <TextField select fullWidth label="Playlist" value={assignValue} onChange={(e) => setAssignValue(e.target.value)}>
            <MenuItem value="">
              <em>None (clear assignment)</em>
            </MenuItem>
            {playlists
              .filter((p) => p.status === "Published")
              .map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name} · {p.items.length} items
                </MenuItem>
              ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setAssignOpen(false)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={bulkAssign} disabled={assignPlaylist.isPending}>
            {assignPlaylist.isPending ? "Saving…" : "Apply"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={locationOpen} onClose={() => setLocationOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Set location for {selected.size} device{selected.size === 1 ? "" : "s"}</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth label="Location" value={locationValue} onChange={(e) => setLocationValue(e.target.value)} placeholder="e.g. Lobby, Floor 2" sx={{ mt: 0.5 }} />
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setLocationOpen(false)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={bulkLocation} disabled={!locationValue.trim() || updateDevice.isPending}>
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
