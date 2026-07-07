import { useState, useMemo, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Box } from "@mui/material";
import { useSnackbar } from "notistack";

import SchedulePageHero from "../../components/schedule/SchedulePageHero";
import ScheduleStatsRow from "../../components/schedule/ScheduleStatsRow";
import ScheduleFiltersBar from "../../components/schedule/ScheduleFiltersBar";
import ScheduleGrid from "../../components/schedule/ScheduleGrid";
import ScheduleEditorDialog from "../../components/schedule/ScheduleEditorDialog";
import SchedulePreviewDialog from "../../components/schedule/SchedulePreviewDialog";
import ConfirmDialog from "../../components/common/ConfirmDialog";

import { ScheduleService } from "../../services/ScheduleService";
import { PlaylistService } from "../../services/PlaylistService";
import { DeviceService } from "../../services/DeviceService";
import { hasActiveFilters, sortSchedules, findConflicts } from "../../components/schedule/utils";

import type { Schedule } from "../../types/schedule";
import type { Playlist } from "../../types/playlist";
import type { Device } from "../../types/device";
import type { StatusFilter, SortField, SortDirection } from "../../components/schedule/types";

export default function SchedulePage() {
  const { enqueueSnackbar } = useSnackbar();

  // ── Data State ───────────────────────────────────────────────────────────
  const [items, setItems] = useState<Schedule[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Router state ─────────────────────────────────────────────────────────
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.state?.openCreateDialog) {
      setEditorMode("create");
      setEditorTarget(undefined);
      setEditorOpen(true);
      
      // Clear the state so refreshing doesn't reopen the dialog
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [schedulesData, playlistsData, devicesData] = await Promise.all([
        ScheduleService.getSchedules(),
        PlaylistService.getPlaylists(),
        DeviceService.getDevices(),
      ]);
      setItems(schedulesData);
      setPlaylists(playlistsData);
      setDevices(devicesData);
    } catch (error) {
      enqueueSnackbar("Failed to load schedule data", { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  // ── Filter & Sort State ──────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [sortField, setSortField] = useState<SortField>("startDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // ── Dialog State ────────────────────────────────────────────────
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editorTarget, setEditorTarget] = useState<Schedule | undefined>(undefined);
  
  const [previewTarget, setPreviewTarget] = useState<Schedule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);

  // ── Derived Data ─────────────────────────────────────────────────────────
  const activeCount = useMemo(() => items.filter(i => i.status === "Active").length, [items]);
  const pausedCount = useMemo(() => items.filter(i => i.status === "Paused").length, [items]);
  
  const conflictingIds = useMemo(() => {
    const active = items.filter(i => i.status === "Active");
    const ids = new Set<string>();
    active.forEach(s => {
      if (findConflicts(active, s).length > 0) ids.add(s.id);
    });
    return Array.from(ids);
  }, [items]);

  const filtersActive = hasActiveFilters(search, statusFilter);

  const filteredItems = useMemo(() => {
    let result = items;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(i => i.name.toLowerCase().includes(q));
    }
    if (statusFilter === "Conflict") {
      result = result.filter(i => conflictingIds.includes(i.id));
    } else if (statusFilter !== "All") {
      result = result.filter(i => i.status === statusFilter);
    }
    return sortSchedules(result, sortField, sortDirection);
  }, [items, search, statusFilter, sortField, sortDirection, conflictingIds]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
    enqueueSnackbar("Schedules refreshed", { variant: "success" });
  }, [enqueueSnackbar]);

  const handleClearFilters = useCallback(() => {
    setSearch("");
    setStatusFilter("All");
  }, []);

  const handleStatClick = useCallback((filter: StatusFilter) => {
    setStatusFilter(filter === "All" ? "All" : filter);
    setSearch("");
  }, []);

  // ── Editor Handlers ──────────────────────────────────────────────────────
  const handleCreate = useCallback(() => {
    setEditorMode("create");
    setEditorTarget(undefined);
    setEditorOpen(true);
  }, []);

  const handleEdit = useCallback((schedule: Schedule) => {
    setEditorMode("edit");
    setEditorTarget(schedule);
    setEditorOpen(true);
  }, []);

  const handleDuplicate = useCallback((schedule: Schedule) => {
    const dup: Schedule = {
      ...schedule,
      id: `SCH-NEW-${Date.now()}`,
      name: `${schedule.name} (Copy)`,
      status: "Draft",
    };
    setEditorMode("create");
    setEditorTarget(dup);
    setEditorOpen(true);
  }, []);

  const handleSaveEditor = useCallback(async (schedule: Schedule) => {
    try {
      const isExisting = items.some(s => s.id === schedule.id);
      let savedSchedule: Schedule;

      if (isExisting) {
        savedSchedule = await ScheduleService.updateSchedule(schedule.id, schedule);
        setItems(prev => prev.map(s => s.id === savedSchedule.id ? savedSchedule : s));
      } else {
        savedSchedule = await ScheduleService.createSchedule(schedule);
        setItems(prev => [savedSchedule, ...prev]);
      }
      enqueueSnackbar(`Schedule "${savedSchedule.name}" saved successfully`, { variant: "success" });
      setEditorOpen(false);
    } catch (err: any) {
      enqueueSnackbar(err.message || "Failed to save schedule", { variant: "error" });
    }
  }, [items, enqueueSnackbar]);

  // ── Delete Handlers ──────────────────────────────────────────────────────
  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await ScheduleService.deleteSchedule(deleteTarget.id);
      setItems(prev => prev.filter(i => i.id !== deleteTarget.id));
      enqueueSnackbar(`Deleted "${deleteTarget.name}"`, { variant: "success" });
    } catch (err: any) {
      enqueueSnackbar(err.message || "Failed to delete schedule", { variant: "error" });
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, enqueueSnackbar]);

  return (
    <Box>
      <SchedulePageHero totalSchedules={activeCount} onCreate={handleCreate} onRefresh={handleRefresh} refreshing={refreshing} />
      <ScheduleStatsRow total={items.length} active={activeCount} paused={pausedCount} conflicts={conflictingIds.length} onStatClick={handleStatClick} loading={loading} />
      <ScheduleFiltersBar search={search} statusFilter={statusFilter} sortField={sortField} sortDirection={sortDirection} resultCount={filteredItems.length} refreshing={refreshing} onSearchChange={setSearch} onStatusFilterChange={setStatusFilter} onSortChange={(field, dir) => { setSortField(field); setSortDirection(dir); }} onClearFilters={handleClearFilters} onRefresh={handleRefresh} />
      <ScheduleGrid schedules={filteredItems} playlists={playlists} conflictingIds={conflictingIds} hasActiveFilters={filtersActive} loading={loading} onEdit={handleEdit} onDuplicate={handleDuplicate} onPreview={setPreviewTarget} onDelete={setDeleteTarget} onClearFilters={handleClearFilters} onCreate={handleCreate} />
      
      <ScheduleEditorDialog open={editorOpen} mode={editorMode} initialSchedule={editorTarget} existingSchedules={items} playlists={playlists} devices={devices} onClose={() => setEditorOpen(false)} onSave={handleSaveEditor} />
      <SchedulePreviewDialog open={!!previewTarget} schedule={previewTarget} playlists={playlists} devices={devices} onClose={() => setPreviewTarget(null)} />
      <ConfirmDialog open={!!deleteTarget} title="Delete Schedule" message={deleteTarget ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.` : ""} onConfirm={handleConfirmDelete} onClose={() => setDeleteTarget(null)} />
    </Box>
  );
}