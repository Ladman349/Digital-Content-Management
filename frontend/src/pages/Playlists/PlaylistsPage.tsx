import { useState, useMemo, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Box } from "@mui/material";
import { useSnackbar } from "notistack";

import PlaylistPageHero from "../../components/playlists/PlaylistPageHero";
import PlaylistStatsRow from "../../components/playlists/PlaylistStatsRow";
import PlaylistFiltersBar from "../../components/playlists/PlaylistFiltersBar";
import PlaylistGrid from "../../components/playlists/PlaylistGrid";
import PlaylistEditor from "../../components/playlists/PlaylistEditor";
import PlaylistPreviewDialog from "../../components/playlists/PlaylistPreviewDialog";
import AssignDevicesDialog from "../../components/playlists/AssignDevicesDialog";
import ConfirmDialog from "../../components/common/ConfirmDialog";

import { PlaylistService } from "../../services/PlaylistService";
import { MediaService } from "../../services/MediaService";
import { DeviceService } from "../../services/DeviceService";
import { hasActiveFilters, sortPlaylists } from "../../components/playlists/utils";

import type { Playlist } from "../../types/playlist";
import type { MediaItem } from "../../types/media";
import type { Device } from "../../types/device";
import type { StatusFilter, SortField, SortDirection } from "../../components/playlists/types";

export default function PlaylistsPage() {
  const { enqueueSnackbar } = useSnackbar();

  // ── Data State ───────────────────────────────────────────────────────────
  const [items, setItems] = useState<Playlist[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Router state ─────────────────────────────────────────────────────────
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.state?.openCreateDialog) {
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
      const [playlistsData, mediaData, devicesData] = await Promise.all([
        PlaylistService.getPlaylists(),
        MediaService.getMedia(),
        DeviceService.getDevices(),
      ]);
      setItems(playlistsData);
      setMediaItems(mediaData);
      setDevices(devicesData);
    } catch (error) {
      enqueueSnackbar("Failed to load playlist data", { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  // ── Filter & Sort State ──────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [sortField, setSortField] = useState<SortField>("updatedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // ── Dialog / Editor State ────────────────────────────────────────────────
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTarget, setEditorTarget] = useState<Playlist | undefined>(undefined);
  const [previewTarget, setPreviewTarget] = useState<Playlist | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Playlist | null>(null);
  const [assignTarget, setAssignTarget] = useState<Playlist | null>(null);

  // ── Derived Data ─────────────────────────────────────────────────────────
  const publishedCount = useMemo(() => items.filter(i => i.status === "Published").length, [items]);
  const draftCount = useMemo(() => items.filter(i => i.status === "Draft").length, [items]);
  const archivedCount = useMemo(() => items.filter(i => i.status === "Archived").length, [items]);

  const filtersActive = hasActiveFilters(search, statusFilter);

  const filteredItems = useMemo(() => {
    let result = items;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(i => i.name.toLowerCase().includes(q));
    }
    if (statusFilter !== "All") {
      result = result.filter(i => i.status === statusFilter);
    }
    return sortPlaylists(result, sortField, sortDirection);
  }, [items, search, statusFilter, sortField, sortDirection]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
    enqueueSnackbar("Playlists refreshed", { variant: "success" });
  }, [enqueueSnackbar]);

  const handleClearFilters = useCallback(() => {
    setSearch("");
    setStatusFilter("All");
  }, []);

  const handleStatClick = useCallback((filter: StatusFilter) => {
    setStatusFilter(filter);
    setSearch("");
  }, []);

  // ── Editor Handlers ──────────────────────────────────────────────────────
  const handleCreate = useCallback(() => {
    setEditorTarget(undefined);
    setEditorOpen(true);
  }, []);

  const handleEdit = useCallback((playlist: Playlist) => {
    setEditorTarget(playlist);
    setEditorOpen(true);
  }, []);

  const handleSaveEditor = useCallback(async (playlist: Playlist) => {
    try {
      const isExisting = items.some(p => p.id === playlist.id);
      let savedPlaylist: Playlist;
      
      if (isExisting) {
        savedPlaylist = await PlaylistService.updatePlaylist(playlist.id, playlist);
        setItems(prev => prev.map(p => p.id === savedPlaylist.id ? savedPlaylist : p));
      } else {
        savedPlaylist = await PlaylistService.createPlaylist(playlist);
        setItems(prev => [savedPlaylist, ...prev]);
      }
      enqueueSnackbar(`Playlist "${savedPlaylist.name}" saved successfully`, { variant: "success" });
      setEditorOpen(false);
    } catch (err: any) {
      enqueueSnackbar(err.message || "Failed to save playlist", { variant: "error" });
    }
  }, [items, enqueueSnackbar]);

  // ── Delete Handlers ──────────────────────────────────────────────────────
  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await PlaylistService.deletePlaylist(deleteTarget.id);
      setItems(prev => prev.filter(i => i.id !== deleteTarget.id));
      enqueueSnackbar(`Deleted "${deleteTarget.name}"`, { variant: "success" });
    } catch (err: any) {
      enqueueSnackbar(err.message || "Failed to delete playlist", { variant: "error" });
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, enqueueSnackbar]);

  // ── Assign Handlers ──────────────────────────────────────────────────────
  const handleSaveAssignments = useCallback(async (deviceIds: string[]) => {
    if (!assignTarget) return;
    try {
      const updated = await PlaylistService.updatePlaylist(assignTarget.id, { assignedDeviceIds: deviceIds, updatedAt: Date.now() });
      setItems(prev => prev.map(p => p.id === updated.id ? updated : p));
      enqueueSnackbar(`Updated device assignments for "${assignTarget.name}"`, { variant: "success" });
      setAssignTarget(null);
    } catch (err) {
      enqueueSnackbar("Failed to update assignments", { variant: "error" });
    }
  }, [assignTarget, enqueueSnackbar]);

  return (
    <Box>
      <PlaylistPageHero totalPlaylists={items.length} onCreate={handleCreate} onRefresh={handleRefresh} refreshing={refreshing} />
      <PlaylistStatsRow total={items.length} published={publishedCount} draft={draftCount} archived={archivedCount} onStatClick={handleStatClick} loading={loading} />
      <PlaylistFiltersBar search={search} statusFilter={statusFilter} sortField={sortField} sortDirection={sortDirection} resultCount={filteredItems.length} refreshing={refreshing} onSearchChange={setSearch} onStatusFilterChange={setStatusFilter} onSortChange={(field, dir) => { setSortField(field); setSortDirection(dir); }} onClearFilters={handleClearFilters} onRefresh={handleRefresh} />
      <PlaylistGrid playlists={filteredItems} mediaItems={mediaItems} loading={loading} hasActiveFilters={filtersActive} onEdit={handleEdit} onPreview={setPreviewTarget} onDelete={setDeleteTarget} onClearFilters={handleClearFilters} onCreate={handleCreate} />
      
      <PlaylistEditor open={editorOpen} initialPlaylist={editorTarget} mediaLibrary={mediaItems} onClose={() => setEditorOpen(false)} onSave={handleSaveEditor} />
      <PlaylistPreviewDialog open={!!previewTarget} items={previewTarget?.items || []} mediaLibrary={mediaItems} onClose={() => setPreviewTarget(null)} />
      <AssignDevicesDialog open={!!assignTarget} devices={devices} initialAssignedIds={assignTarget?.assignedDeviceIds || []} onClose={() => setAssignTarget(null)} onSave={handleSaveAssignments} />
      <ConfirmDialog open={!!deleteTarget} title="Delete Playlist" message={deleteTarget ? `Are you sure you want to delete "${deleteTarget.name}"? This will not delete the underlying media files.` : ""} onConfirm={handleConfirmDelete} onClose={() => setDeleteTarget(null)} />
    </Box>
  );
}