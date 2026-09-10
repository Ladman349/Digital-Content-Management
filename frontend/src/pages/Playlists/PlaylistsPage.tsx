import { useMemo, useState } from "react";
import { Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Typography } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import PublishRoundedIcon from "@mui/icons-material/PublishRounded";
import FilterListOffRoundedIcon from "@mui/icons-material/FilterListOffRounded";
import PlaylistPlayRoundedIcon from "@mui/icons-material/PlaylistPlayRounded";
import TvRoundedIcon from "@mui/icons-material/TvRounded";
import { useSnackbar } from "notistack";
import { useSearchParams } from "react-router-dom";

import PageHeader from "../../components/ui/PageHeader";
import SearchField from "../../components/ui/SearchField";
import SegmentedFilter from "../../components/ui/SegmentedFilter";
import DataTable, { type Column, type SortState } from "../../components/ui/DataTable";
import EmptyState from "../../components/ui/EmptyState";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import BulkBar from "../../components/ui/BulkBar";
import StatusChip from "../../components/ui/StatusChip";
import MediaThumb from "../../components/ui/MediaThumb";
import RowLead from "../../components/ui/RowLead";
import PlaylistEditor from "./PlaylistEditor";
import PlaylistDetailPanel from "./PlaylistDetailPanel";

import { useCreatePlaylist, useDeletePlaylists, useDevices, useMedia, usePlaylists, useSchedules, useUpdatePlaylist } from "../../hooks/queries";
import { useFilterParam, useSelectParam } from "../../hooks/useSelectParam";
import type { Playlist, PlaylistStatus } from "../../types/playlist";
import { formatDate, formatDuration, pluralize } from "../../utils/format";

type StatusFilter = "All" | PlaylistStatus;

export default function PlaylistsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [params, setParams] = useSearchParams();
  const { data: playlists = [], isLoading } = usePlaylists();
  const { data: media = [] } = useMedia();
  const { data: devices = [] } = useDevices();
  const { data: schedules = [] } = useSchedules();
  const createPlaylist = useCreatePlaylist();
  const updatePlaylist = useUpdatePlaylist();
  const deletePlaylists = useDeletePlaylists();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useFilterParam("status", "All");
  const [sort, setSort] = useState<SortState>({ key: "updated", direction: "desc" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useSelectParam();
  // Seeded from ?new=1 so the dashboard button deep-links straight into the editor.
  const [editorOpen, setEditorOpen] = useState(() => params.get("new") === "1");
  const [editing, setEditing] = useState<Playlist | null>(null);
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  const [assignTarget, setAssignTarget] = useState<Playlist | null>(null);
  const [assignIds, setAssignIds] = useState<string[]>([]);

  const closeEditor = () => {
    setEditorOpen(false);
    if (params.has("new")) {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("new");
          return next;
        },
        { replace: true },
      );
    }
  };

  const mediaById = useMemo(() => new Map(media.map((m) => [m.id, m])), [media]);
  const counts = useMemo(
    () => ({
      All: playlists.length,
      Published: playlists.filter((p) => p.status === "Published").length,
      Draft: playlists.filter((p) => p.status === "Draft").length,
      Archived: playlists.filter((p) => p.status === "Archived").length,
    }),
    [playlists],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = playlists;
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
    if (statusFilter !== "All") list = list.filter((p) => p.status === statusFilter);
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      switch (sort.key) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "items":
          return (a.items.length - b.items.length) * dir;
        case "duration":
          return (a.totalDuration - b.totalDuration) * dir;
        case "screens":
          return (a.assignedDeviceIds.length - b.assignedDeviceIds.length) * dir;
        default:
          return (a.updatedAt - b.updatedAt) * dir;
      }
    });
  }, [playlists, search, statusFilter, sort]);

  const selectedPlaylist = useMemo(() => playlists.find((p) => p.id === selectedId) ?? null, [playlists, selectedId]);
  const selectedIndex = rows.findIndex((p) => p.id === selectedId);
  const filtersActive = Boolean(search.trim()) || statusFilter !== "All";
  const clearFilters = () => {
    setSearch("");
    setStatusFilter("All");
  };

  const openEditor = (p: Playlist | null) => {
    setEditing(p);
    setEditorOpen(true);
  };

  const saveEditor = async (data: { name: string; description: string; status: PlaylistStatus; items: Playlist["items"]; totalDuration: number }) => {
    try {
      if (editing) {
        await updatePlaylist.mutateAsync({ id: editing.id, data: { ...data, updatedAt: Date.now() } });
        enqueueSnackbar("Playlist saved", { variant: "success" });
      } else {
        const created = await createPlaylist.mutateAsync({ ...data, assignedDeviceIds: [], updatedAt: Date.now() });
        enqueueSnackbar("Playlist created", { variant: "success" });
        setSelectedId(created.id);
      }
      closeEditor();
    } catch (e) {
      enqueueSnackbar((e as Error).message, { variant: "error" });
    }
  };

  const confirmDelete = async () => {
    if (!deleteIds) return;
    try {
      const result = await deletePlaylists.mutateAsync(deleteIds);
      if (result.failed.length) enqueueSnackbar(`${result.ok.length} deleted, ${result.failed.length} failed: ${result.failed[0].error}`, { variant: "warning" });
      else enqueueSnackbar(`${result.ok.length} playlist${result.ok.length === 1 ? "" : "s"} deleted`, { variant: "success" });
      setSelected(new Set());
      if (selectedId && result.ok.includes(selectedId)) setSelectedId(null);
    } catch (e) {
      enqueueSnackbar((e as Error).message, { variant: "error" });
    } finally {
      setDeleteIds(null);
    }
  };

  const bulkStatus = async (status: PlaylistStatus) => {
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map((id) => updatePlaylist.mutateAsync({ id, data: { status } })));
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length) enqueueSnackbar(`${ids.length - failed.length} updated, ${failed.length} refused (playlists used by active schedules cannot change status)`, { variant: "warning" });
    else enqueueSnackbar(`${ids.length} playlist${ids.length === 1 ? "" : "s"} set to ${status}`, { variant: "success" });
  };

  const openAssign = (p: Playlist) => {
    setAssignTarget(p);
    setAssignIds(p.assignedDeviceIds);
  };

  const saveAssign = async () => {
    if (!assignTarget) return;
    try {
      await updatePlaylist.mutateAsync({ id: assignTarget.id, data: { assignedDeviceIds: assignIds } });
      enqueueSnackbar("Screens updated", { variant: "success" });
      setAssignTarget(null);
    } catch (e) {
      enqueueSnackbar((e as Error).message, { variant: "error" });
    }
  };

  const columns: Column<Playlist>[] = [
    {
      key: "name",
      label: "Playlist",
      sortable: true,
      render: (p) => (
        <RowLead
          before={
            <Box sx={{ display: "flex", gap: "2px" }}>
              {p.items.slice(0, 3).map((i) => (
                <MediaThumb key={i.id} media={mediaById.get(i.mediaId)} width={26} height={40} />
              ))}
              {p.items.length === 0 && <MediaThumb media={null} width={26} height={40} />}
            </Box>
          }
          name={p.name}
          sub={p.description || p.id}
          title={p.name}
        />
      ),
    },
    { key: "status", label: "Status", width: 120, onCard: true, render: (p) => <StatusChip label={p.status} /> },
    { key: "items", label: "Items", width: 80, align: "right", sortable: true, onCard: true, render: (p) => <Typography variant="caption" sx={{ fontSize: 14 }}>{p.items.length}</Typography> },
    { key: "duration", label: "Runs for", width: 110, align: "right", sortable: true, onCard: true, render: (p) => <Typography variant="caption" sx={{ fontSize: 14, fontVariantNumeric: "tabular-nums" }}>{formatDuration(p.totalDuration)}</Typography> },
    {
      key: "screens",
      label: "Screens",
      width: 120,
      sortable: true,
      hideBelow: "md",
      render: (p) => (
        <Typography variant="body2" color={p.assignedDeviceIds.length ? "text.primary" : "text.disabled"}>
          {p.assignedDeviceIds.length ? pluralize(p.assignedDeviceIds.length, "screen") : "—"}
        </Typography>
      ),
    },
    { key: "schedules", label: "Schedules", width: 100, hideBelow: "lg", render: (p) => <Typography variant="body2" color="text.secondary">{schedules.filter((s) => s.playlistId === p.id).length || "—"}</Typography> },
    { key: "updated", label: "Updated", width: 110, sortable: true, hideBelow: "sm", render: (p) => <Typography variant="body2" color="text.secondary">{formatDate(p.updatedAt)}</Typography> },
  ];

  return (
    <Box>
      <PageHeader
        title="Playlists"
        meta={!isLoading && <span>{counts.All} total · {counts.Published} published</span>}
        actions={
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => openEditor(null)}>
            New playlist
          </Button>
        }
      >
        <SearchField value={search} onChange={setSearch} placeholder="Search playlists…" />
        <SegmentedFilter<StatusFilter>
          ariaLabel="Filter by status"
          value={statusFilter as StatusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "All", label: "All", count: counts.All },
            { value: "Published", label: "Published", count: counts.Published },
            { value: "Draft", label: "Draft", count: counts.Draft },
            { value: "Archived", label: "Archived", count: counts.Archived },
          ]}
        />
        {filtersActive && (
          <Button size="small" onClick={clearFilters} startIcon={<FilterListOffRoundedIcon />}>
            Clear
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Typography variant="body2" color="text.secondary">
          {rows.length === playlists.length ? `${rows.length} playlists` : `${rows.length} of ${playlists.length}`}
        </Typography>
      </PageHeader>

      <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <DataTable<Playlist>
            columns={columns}
            rows={rows}
            rowKey={(p) => p.id}
            loading={isLoading}
            selectable
            selected={selected}
            onSelectionChange={setSelected}
            onRowClick={(p) => setSelectedId(p.id === selectedId ? null : p.id)}
            activeRowKey={selectedId}
            sort={sort}
            onSortChange={setSort}
            emptyState={
              filtersActive ? (
                <EmptyState icon={FilterListOffRoundedIcon} title="No playlists match" description="Try a different search or clear the filters." actionLabel="Clear filters" onAction={clearFilters} />
              ) : (
                <EmptyState icon={PlaylistPlayRoundedIcon} title="No playlists yet" description="A playlist is an ordered sequence of media with a duration for each item. Publish it, then assign or schedule it on screens." actionLabel="New playlist" onAction={() => openEditor(null)} />
              )
            }
          />

          <BulkBar count={selected.size} noun="playlist" onClear={() => setSelected(new Set())} onSelectAll={() => setSelected(new Set(rows.map((p) => p.id)))} total={rows.length}>
            <Button variant="outlined" startIcon={<PublishRoundedIcon />} onClick={() => bulkStatus("Published")}>
              Publish
            </Button>
            <Button variant="outlined" onClick={() => bulkStatus("Archived")}>
              Archive
            </Button>
            <Button variant="outlined" color="error" startIcon={<DeleteOutlineRoundedIcon />} onClick={() => setDeleteIds([...selected])}>
              Delete
            </Button>
          </BulkBar>
        </Box>

        <PlaylistDetailPanel
          playlist={selectedPlaylist}
          media={media}
          devices={devices}
          schedules={schedules}
          onClose={() => setSelectedId(null)}
          onPrev={selectedIndex > 0 ? () => setSelectedId(rows[selectedIndex - 1].id) : undefined}
          onNext={selectedIndex >= 0 && selectedIndex < rows.length - 1 ? () => setSelectedId(rows[selectedIndex + 1].id) : undefined}
          position={selectedIndex >= 0 ? `${selectedIndex + 1} / ${rows.length}` : undefined}
          onEdit={openEditor}
          onDelete={(p) => setDeleteIds([p.id])}
          onAssign={openAssign}
        />
      </Box>

      {editorOpen && (
        <PlaylistEditor
          key={editing?.id ?? "new"}
          playlist={editing}
          mediaLibrary={media}
          saving={createPlaylist.isPending || updatePlaylist.isPending}
          onClose={closeEditor}
          onSave={saveEditor}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteIds)}
        title={deleteIds && deleteIds.length > 1 ? `Delete ${deleteIds.length} playlists?` : "Delete playlist?"}
        message="Playlists referenced by a schedule cannot be deleted until the schedule is removed. The media files themselves are not affected."
        loading={deletePlaylists.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleteIds(null)}
      />

      <Dialog open={Boolean(assignTarget)} onClose={() => setAssignTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Screens playing “{assignTarget?.name}”</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            These screens play this playlist whenever no schedule is live. A screen can only have one direct assignment.
          </Typography>
          {devices.length === 0 ? (
            <EmptyState compact icon={TvRoundedIcon} title="No devices registered" />
          ) : (
            <Box sx={{ display: "grid", maxHeight: 320, overflowY: "auto" }}>
              {devices.map((d) => (
                <FormControlLabel
                  key={d.id}
                  control={
                    <Checkbox
                      size="small"
                      checked={assignIds.includes(d.id)}
                      onChange={(e) => setAssignIds((ids) => (e.target.checked ? [...ids, d.id] : ids.filter((x) => x !== d.id)))}
                    />
                  }
                  label={
                    <Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{d.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {d.location} · {d.status}
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setAssignTarget(null)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={saveAssign} disabled={updatePlaylist.isPending}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
