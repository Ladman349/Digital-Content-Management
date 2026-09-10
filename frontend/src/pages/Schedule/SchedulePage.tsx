import { useMemo, useState } from "react";
import { Box, Button, Tooltip, Typography } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import PauseRoundedIcon from "@mui/icons-material/PauseRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import FilterListOffRoundedIcon from "@mui/icons-material/FilterListOffRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import ViewListRoundedIcon from "@mui/icons-material/ViewListRounded";
import ViewTimelineRoundedIcon from "@mui/icons-material/ViewTimelineRounded";
import { ToggleButton, ToggleButtonGroup } from "@mui/material";
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
import RowLead from "../../components/ui/RowLead";
import { MONO } from "../../app/theme";
import ScheduleEditor, { type ScheduleFormValues } from "./ScheduleEditor";
import ScheduleDetailPanel from "./ScheduleDetailPanel";
import DayTimeline from "./DayTimeline";

import { useCreateSchedule, useDeleteSchedules, useDevices, usePlaylists, useSchedules, useUpdateSchedule } from "../../hooks/queries";
import { useFilterParam, useSelectParam } from "../../hooks/useSelectParam";
import { usePersistedState } from "../../hooks/usePersistedState";
import { useNow } from "../../hooks/useNow";
import type { Schedule, ScheduleStatus } from "../../types/schedule";
import { findConflicts, isScheduleExpired, isScheduleLiveNow } from "../../utils/schedule";
import { formatDate, minutesOfDay } from "../../utils/format";

type StatusFilter = "All" | "Live" | ScheduleStatus | "Conflict";

export default function SchedulePage() {
  const { enqueueSnackbar } = useSnackbar();
  const now = useNow(30_000);
  const [params, setParams] = useSearchParams();
  const { data: schedules = [], isLoading } = useSchedules();
  const { data: playlists = [] } = usePlaylists();
  const { data: devices = [] } = useDevices();
  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();
  const deleteSchedules = useDeleteSchedules();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useFilterParam("status", "All");
  const [deviceFilter, setDeviceFilter] = useFilterParam("device", "All");
  const [sort, setSort] = useState<SortState>({ key: "time", direction: "asc" });
  const [view, setView] = usePersistedState<"list" | "timeline">("signage.schedule.view", "list");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useSelectParam();
  // Seeded from ?new=1 so the dashboard button deep-links straight into the editor.
  const [editorOpen, setEditorOpen] = useState(() => params.get("new") === "1");
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [duplicating, setDuplicating] = useState<Schedule | null>(null);
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);

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

  const playlistById = useMemo(() => new Map(playlists.map((p) => [p.id, p])), [playlists]);
  const deviceById = useMemo(() => new Map(devices.map((d) => [d.id, d])), [devices]);

  const conflictIds = useMemo(() => {
    const active = schedules.filter((s) => s.status === "Active");
    const ids = new Set<string>();
    active.forEach((s) => {
      if (findConflicts(active, s).length) ids.add(s.id);
    });
    return ids;
  }, [schedules]);

  const liveIds = useMemo(() => new Set(schedules.filter((s) => isScheduleLiveNow(s, new Date(now))).map((s) => s.id)), [schedules, now]);

  const counts = useMemo(
    () => ({
      All: schedules.length,
      Live: liveIds.size,
      Active: schedules.filter((s) => s.status === "Active").length,
      Draft: schedules.filter((s) => s.status === "Draft").length,
      Paused: schedules.filter((s) => s.status === "Paused").length,
      Conflict: conflictIds.size,
    }),
    [schedules, liveIds, conflictIds],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = schedules;
    if (q) list = list.filter((s) => s.name.toLowerCase().includes(q) || (playlistById.get(s.playlistId)?.name.toLowerCase().includes(q) ?? false));
    if (deviceFilter !== "All") list = list.filter((s) => s.deviceIds.includes(deviceFilter));
    if (statusFilter === "Live") list = list.filter((s) => liveIds.has(s.id));
    else if (statusFilter === "Conflict") list = list.filter((s) => conflictIds.has(s.id));
    else if (statusFilter !== "All") list = list.filter((s) => s.status === statusFilter);
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      switch (sort.key) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "dates":
          return a.startDate.localeCompare(b.startDate) * dir;
        case "screens":
          return (a.deviceIds.length - b.deviceIds.length) * dir;
        default:
          return (minutesOfDay(a.startTime) - minutesOfDay(b.startTime)) * dir;
      }
    });
  }, [schedules, search, statusFilter, deviceFilter, sort, liveIds, conflictIds, playlistById]);

  const selectedSchedule = useMemo(() => schedules.find((s) => s.id === selectedId) ?? null, [schedules, selectedId]);
  const selectedIndex = rows.findIndex((s) => s.id === selectedId);
  const filtersActive = Boolean(search.trim()) || statusFilter !== "All" || deviceFilter !== "All";
  const clearFilters = () => {
    setSearch("");
    setStatusFilter("All");
    setDeviceFilter("All");
  };

  const openEditor = (s: Schedule | null, dup: Schedule | null = null) => {
    setEditing(s);
    setDuplicating(dup);
    setEditorOpen(true);
  };

  const save = async (values: ScheduleFormValues) => {
    try {
      if (editing) {
        await updateSchedule.mutateAsync({ id: editing.id, data: values });
        enqueueSnackbar("Schedule saved", { variant: "success" });
      } else {
        const created = await createSchedule.mutateAsync(values);
        enqueueSnackbar("Schedule created", { variant: "success" });
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
      const result = await deleteSchedules.mutateAsync(deleteIds);
      if (result.failed.length) enqueueSnackbar(`${result.ok.length} deleted, ${result.failed.length} failed`, { variant: "warning" });
      else enqueueSnackbar(`${result.ok.length} schedule${result.ok.length === 1 ? "" : "s"} deleted`, { variant: "success" });
      setSelected(new Set());
      if (selectedId && result.ok.includes(selectedId)) setSelectedId(null);
    } catch (e) {
      enqueueSnackbar((e as Error).message, { variant: "error" });
    } finally {
      setDeleteIds(null);
    }
  };

  const bulkStatus = async (status: ScheduleStatus) => {
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map((id) => updateSchedule.mutateAsync({ id, data: { status } })));
    const failed = results.filter((r) => r.status === "rejected").length;
    enqueueSnackbar(failed ? `${ids.length - failed} updated, ${failed} refused by the server (conflicting windows)` : `${ids.length} schedule${ids.length === 1 ? "" : "s"} set to ${status}`, { variant: failed ? "warning" : "success" });
  };

  const columns: Column<Schedule>[] = [
    {
      key: "name",
      label: "Schedule",
      sortable: true,
      render: (s) => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
          <RowLead
            name={s.name}
            sub={`${s.repeat} · ${playlistById.get(s.playlistId)?.name ?? `missing playlist ${s.playlistId}`}`}
            title={s.name}
          />
          {liveIds.has(s.id) && <StatusChip label="Live" tone="success" pulse />}
          {conflictIds.has(s.id) && (
            <Tooltip title="Overlaps another active schedule on a shared screen">
              <WarningAmberRoundedIcon sx={{ fontSize: 15, color: "warning.main", flexShrink: 0 }} />
            </Tooltip>
          )}
        </Box>
      ),
    },
    { key: "status", label: "Status", width: 120, onCard: true, render: (s) => <StatusChip label={s.status} /> },
    {
      key: "time",
      label: "Window",
      width: 120,
      onCard: true,
      sortable: true,
      render: (s) => (
        <Box>
          <Typography sx={{ fontFamily: MONO, fontSize: 15, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{s.startTime}</Typography>
          <Typography sx={{ fontFamily: MONO, fontSize: 11, color: "text.secondary", mt: 0.3 }}>→ {s.endTime}</Typography>
        </Box>
      ),
    },
    {
      key: "dates",
      label: "Runs",
      width: 170,
      sortable: true,
      hideBelow: "md",
      render: (s) => (
        <Typography variant="body2" color={isScheduleExpired(s, new Date(now)) ? "error.main" : "text.secondary"}>
          {s.startDate === s.endDate ? formatDate(s.startDate) : `${formatDate(s.startDate)} → ${formatDate(s.endDate)}`}
        </Typography>
      ),
    },
    {
      key: "screens",
      label: "Screens",
      width: 150,
      sortable: true,
      hideBelow: "lg",
      render: (s) => (
        <Typography variant="body2" color="text.secondary" noWrap>
          {s.deviceIds.length === 0 ? "—" : s.deviceIds.length <= 2 ? s.deviceIds.map((id) => deviceById.get(id)?.name ?? id).join(", ") : `${s.deviceIds.length} screens`}
        </Typography>
      ),
    },
    { key: "priority", label: "Priority", width: 100, hideBelow: "md", render: (s) => <StatusChip label={s.priority} dot={false} /> },
  ];

  return (
    <Box>
      <PageHeader
        title="Schedule"
        meta={!isLoading && <span>{counts.Live} live now · {counts.Active} active · {counts.All} total</span>}
        actions={
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => openEditor(null)}>
            New schedule
          </Button>
        }
      >
        <SearchField value={search} onChange={setSearch} placeholder="Search schedules…" />
        <SegmentedFilter<StatusFilter>
          ariaLabel="Filter by status"
          value={statusFilter as StatusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "All", label: "All", count: counts.All },
            { value: "Live", label: "Live now", count: counts.Live },
            { value: "Active", label: "Active", count: counts.Active },
            { value: "Paused", label: "Paused", count: counts.Paused },
            { value: "Draft", label: "Draft", count: counts.Draft },
            { value: "Conflict", label: "Conflicts", count: counts.Conflict },
          ]}
        />
        {filtersActive && (
          <Button size="small" onClick={clearFilters} startIcon={<FilterListOffRoundedIcon />}>
            Clear
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Typography variant="body2" color="text.secondary">
          {rows.length === schedules.length ? `${rows.length} schedules` : `${rows.length} of ${schedules.length}`}
        </Typography>
        <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setView(v)} aria-label="View mode">
          <ToggleButton value="list" aria-label="List view">
            <ViewListRoundedIcon sx={{ fontSize: 18 }} />
          </ToggleButton>
          <ToggleButton value="timeline" aria-label="Day timeline view">
            <ViewTimelineRoundedIcon sx={{ fontSize: 18 }} />
          </ToggleButton>
        </ToggleButtonGroup>
      </PageHeader>

      <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {view === "timeline" ? (
            <DayTimeline schedules={rows} devices={devices} playlists={playlists} now={now} selectedId={selectedId} onSelect={setSelectedId} deviceFilter={deviceFilter} onDeviceFilter={setDeviceFilter} />
          ) : (
            <DataTable<Schedule>
              columns={columns}
              rows={rows}
              rowKey={(s) => s.id}
              loading={isLoading}
              selectable
              selected={selected}
              onSelectionChange={setSelected}
              onRowClick={(s) => setSelectedId(s.id === selectedId ? null : s.id)}
              activeRowKey={selectedId}
              sort={sort}
              onSortChange={setSort}
              rowHighlight={(s) => (conflictIds.has(s.id) ? "warning" : undefined)}
              emptyState={
                filtersActive ? (
                  <EmptyState icon={FilterListOffRoundedIcon} title="No schedules match" description="Try a different search or clear the filters." actionLabel="Clear filters" onAction={clearFilters} />
                ) : (
                  <EmptyState icon={EventRoundedIcon} title="No schedules yet" description="A schedule plays a published playlist on chosen screens during a daily time window. Without one, screens play their directly assigned playlist." actionLabel="New schedule" onAction={() => openEditor(null)} />
                )
              }
            />
          )}

          <BulkBar count={selected.size} noun="schedule" onClear={() => setSelected(new Set())} onSelectAll={() => setSelected(new Set(rows.map((s) => s.id)))} total={rows.length}>
            <Button variant="outlined" startIcon={<PlayArrowRoundedIcon />} onClick={() => bulkStatus("Active")}>
              Activate
            </Button>
            <Button variant="outlined" startIcon={<PauseRoundedIcon />} onClick={() => bulkStatus("Paused")}>
              Pause
            </Button>
            <Button variant="outlined" color="error" startIcon={<DeleteOutlineRoundedIcon />} onClick={() => setDeleteIds([...selected])}>
              Delete
            </Button>
          </BulkBar>
        </Box>

        <ScheduleDetailPanel
          schedule={selectedSchedule}
          playlists={playlists}
          devices={devices}
          allSchedules={schedules}
          now={now}
          onClose={() => setSelectedId(null)}
          onPrev={selectedIndex > 0 ? () => setSelectedId(rows[selectedIndex - 1].id) : undefined}
          onNext={selectedIndex >= 0 && selectedIndex < rows.length - 1 ? () => setSelectedId(rows[selectedIndex + 1].id) : undefined}
          position={selectedIndex >= 0 ? `${selectedIndex + 1} / ${rows.length}` : undefined}
          onEdit={(s) => openEditor(s)}
          onDuplicate={(s) => openEditor(null, s)}
          onDelete={(s) => setDeleteIds([s.id])}
        />
      </Box>

      {editorOpen && (
        <ScheduleEditor
          key={editing?.id ?? duplicating?.id ?? "new"}
          schedule={editing}
          duplicateOf={duplicating}
          playlists={playlists}
          devices={devices}
          allSchedules={schedules}
          saving={createSchedule.isPending || updateSchedule.isPending}
          onClose={closeEditor}
          onSave={save}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteIds)}
        title={deleteIds && deleteIds.length > 1 ? `Delete ${deleteIds.length} schedules?` : "Delete schedule?"}
        message="Screens fall back to their directly assigned playlist once the schedule is gone."
        loading={deleteSchedules.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleteIds(null)}
      />
    </Box>
  );
}
