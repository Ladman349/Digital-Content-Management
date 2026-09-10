import { useMemo, useState } from "react";
import { Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from "@mui/material";
import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";
import GridViewRoundedIcon from "@mui/icons-material/GridViewRounded";
import ViewListRoundedIcon from "@mui/icons-material/ViewListRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import FilterListOffRoundedIcon from "@mui/icons-material/FilterListOffRounded";
import PermMediaRoundedIcon from "@mui/icons-material/PermMediaRounded";
import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";
import { useSnackbar } from "notistack";
import { useSearchParams } from "react-router-dom";

import PageHeader from "../../components/ui/PageHeader";
import SearchField from "../../components/ui/SearchField";
import SegmentedFilter from "../../components/ui/SegmentedFilter";
import FilterSelect from "../../components/ui/FilterSelect";
import DataTable, { type Column, type SortState } from "../../components/ui/DataTable";
import EmptyState from "../../components/ui/EmptyState";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import BulkBar from "../../components/ui/BulkBar";
import MediaThumb from "../../components/ui/MediaThumb";
import RowLead from "../../components/ui/RowLead";
import StatusChip from "../../components/ui/StatusChip";
import MediaDetailPanel from "./MediaDetailPanel";
import UploadDialog from "./UploadDialog";

import { useDeleteMedia, useMedia, usePlaylists, useUpdateMedia } from "../../hooks/queries";
import { useFilterParam, useSelectParam } from "../../hooks/useSelectParam";
import { usePersistedState } from "../../hooks/usePersistedState";
import { MEDIA_CATEGORIES, type MediaCategory, type MediaItem, type MediaType } from "../../types/media";
import { formatBytes, formatDate, formatDuration } from "../../utils/format";

type TypeFilter = "All" | MediaType;
type SortKey = "newest" | "oldest" | "name" | "size";

export default function MediaPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [params, setParams] = useSearchParams();
  const { data: items = [], isLoading } = useMedia();
  const { data: playlists = [] } = usePlaylists();
  const deleteMedia = useDeleteMedia();
  const updateMedia = useUpdateMedia();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useFilterParam("type", "All");
  const [categoryFilter, setCategoryFilter] = useFilterParam("category", "All");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  // The board is the default read; the grid is there for when you are choosing artwork rather than auditing it.
  const [view, setView] = usePersistedState<"grid" | "list">("signage.media.view", "list");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useSelectParam();
  // Seeded from ?upload=1 so the dashboard button deep-links straight into the dialog.
  const [uploadOpen, setUploadOpen] = useState(() => params.get("upload") === "1");
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryValue, setCategoryValue] = useState<MediaCategory>("Announcement");

  const closeUpload = () => {
    setUploadOpen(false);
    if (params.has("upload")) {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("upload");
          return next;
        },
        { replace: true },
      );
    }
  };

  const usage = useMemo(() => {
    const map = new Map<string, number>();
    playlists.forEach((p) => p.items.forEach((i) => map.set(i.mediaId, (map.get(i.mediaId) ?? 0) + 1)));
    return map;
  }, [playlists]);

  const counts = useMemo(
    () => ({ All: items.length, Image: items.filter((i) => i.type === "Image").length, Video: items.filter((i) => i.type === "Video").length }),
    [items],
  );
  const totalBytes = useMemo(() => items.reduce((s, i) => s + (i.size || 0), 0), [items]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = items;
    if (q) list = list.filter((i) => i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q));
    if (typeFilter !== "All") list = list.filter((i) => i.type === typeFilter);
    if (categoryFilter !== "All") list = list.filter((i) => i.category === categoryFilter);
    return [...list].sort((a, b) => {
      switch (sortKey) {
        case "oldest":
          return a.uploadedAt - b.uploadedAt;
        case "name":
          return a.name.localeCompare(b.name);
        case "size":
          return b.size - a.size;
        default:
          return b.uploadedAt - a.uploadedAt;
      }
    });
  }, [items, search, typeFilter, categoryFilter, sortKey]);

  const selectedItem = useMemo(() => items.find((i) => i.id === selectedId) ?? null, [items, selectedId]);
  const selectedIndex = rows.findIndex((i) => i.id === selectedId);
  const filtersActive = Boolean(search.trim()) || typeFilter !== "All" || categoryFilter !== "All";
  const clearFilters = () => {
    setSearch("");
    setTypeFilter("All");
    setCategoryFilter("All");
  };

  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const confirmDelete = async () => {
    if (!deleteIds) return;
    try {
      const result = await deleteMedia.mutateAsync(deleteIds);
      if (result.failed.length) enqueueSnackbar(`${result.ok.length} deleted, ${result.failed.length} failed: ${result.failed[0].error}`, { variant: "warning" });
      else enqueueSnackbar(`${result.ok.length} file${result.ok.length === 1 ? "" : "s"} deleted`, { variant: "success" });
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

  const bulkCategory = async () => {
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map((id) => updateMedia.mutateAsync({ id, data: { category: categoryValue } })));
    const failed = results.filter((r) => r.status === "rejected").length;
    enqueueSnackbar(failed ? `${ids.length - failed} updated, ${failed} failed` : `Category set on ${ids.length} file${ids.length === 1 ? "" : "s"}`, { variant: failed ? "warning" : "success" });
    setCategoryOpen(false);
  };

  const deleteMessage = (ids: string[]) => {
    const inUse = ids.filter((id) => usage.get(id));
    return (
      <Box>
        <Typography variant="body2" color="text.secondary">
          {ids.length === 1 ? `“${items.find((i) => i.id === ids[0])?.name}” will be permanently removed.` : `${ids.length} files will be permanently removed.`}
        </Typography>
        {inUse.length > 0 && (
          <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
            {inUse.length === 1 ? "This file is" : `${inUse.length} of these files are`} used in playlists; the server will refuse to delete those until they are removed from the playlists.
          </Typography>
        )}
      </Box>
    );
  };

  const columns: Column<MediaItem>[] = [
    {
      key: "name",
      label: "File",
      render: (m) => (
        <RowLead
          size="compact"
          before={<MediaThumb media={m} width={64} height={40} />}
          name={m.name}
          sub={`${m.id}${m.type === "Video" && m.duration ? ` · ${formatDuration(m.duration)}` : ""}`}
          title={m.name}
        />
      ),
    },
    { key: "type", label: "Type", width: 90, render: (m) => <StatusChip label={m.type} dot={false} /> },
    { key: "category", label: "Category", hideBelow: "md", render: (m) => <Typography variant="body2">{m.category}</Typography> },
    { key: "dimensions", label: "Dimensions", hideBelow: "lg", render: (m) => <Typography variant="body2" color="text.secondary">{m.dimensions || "—"}</Typography> },
    { key: "duration", label: "Duration", hideBelow: "lg", width: 90, render: (m) => <Typography variant="body2" color="text.secondary">{m.type === "Video" ? (m.duration ? formatDuration(m.duration) : "?") : "—"}</Typography> },
    { key: "size", label: "Size", width: 100, align: "right", onCard: true, render: (m) => <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>{formatBytes(m.size)}</Typography> },
    {
      key: "used",
      label: "Used in",
      width: 130,
      hideBelow: "md",
      onCard: true,
      render: (m) =>
        usage.get(m.id) ? (
          <StatusChip label={`${usage.get(m.id)} playlist${usage.get(m.id) === 1 ? "" : "s"}`} tone="warning" />
        ) : (
          <StatusChip label="Unused" tone="neutral" />
        ),
    },
    { key: "uploaded", label: "Uploaded", width: 110, hideBelow: "sm", render: (m) => <Typography variant="body2" color="text.secondary">{formatDate(m.uploadedAt)}</Typography> },
  ];

  const empty = filtersActive ? (
    <EmptyState icon={FilterListOffRoundedIcon} title="No media matches" description="Try a different search or clear the filters." actionLabel="Clear filters" onAction={clearFilters} />
  ) : (
    <EmptyState icon={PermMediaRoundedIcon} title="No media yet" description="Upload images and videos to build playlists from." actionLabel="Upload media" onAction={() => setUploadOpen(true)} />
  );

  return (
    <Box>
      <PageHeader
        title="Media"
        meta={
          !isLoading && (
            <>
              <span>{items.length} files</span>
              <span>·</span>
              <span>{formatBytes(totalBytes)}</span>
            </>
          )
        }
        actions={
          <Button variant="contained" startIcon={<CloudUploadRoundedIcon />} onClick={() => setUploadOpen(true)}>
            Upload
          </Button>
        }
      >
        <SearchField value={search} onChange={setSearch} placeholder="Search by name or ID…" />
        <SegmentedFilter<TypeFilter>
          ariaLabel="Filter by type"
          value={typeFilter as TypeFilter}
          onChange={setTypeFilter}
          options={[
            { value: "All", label: "All", count: counts.All },
            { value: "Image", label: "Images", count: counts.Image },
            { value: "Video", label: "Videos", count: counts.Video },
          ]}
        />
        <FilterSelect label="Category" value={categoryFilter} onChange={setCategoryFilter} options={[{ value: "All", label: "All categories" }, ...MEDIA_CATEGORIES.map((c) => ({ value: c, label: c }))]} width={160} />
        <FilterSelect
          label="Sort"
          value={sortKey}
          onChange={(v) => setSortKey(v as SortKey)}
          options={[
            { value: "newest", label: "Newest first" },
            { value: "oldest", label: "Oldest first" },
            { value: "name", label: "Name A–Z" },
            { value: "size", label: "Largest first" },
          ]}
          width={140}
        />
        {filtersActive && (
          <Button size="small" onClick={clearFilters} startIcon={<FilterListOffRoundedIcon />}>
            Clear
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Typography variant="body2" color="text.secondary">
          {rows.length === items.length ? `${rows.length} files` : `${rows.length} of ${items.length}`}
        </Typography>
        <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setView(v)} aria-label="View mode">
          <ToggleButton value="grid" aria-label="Grid view">
            <GridViewRoundedIcon sx={{ fontSize: 18 }} />
          </ToggleButton>
          <ToggleButton value="list" aria-label="List view">
            <ViewListRoundedIcon sx={{ fontSize: 18 }} />
          </ToggleButton>
        </ToggleButtonGroup>
      </PageHeader>

      <Box sx={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {view === "list" ? (
            <DataTable<MediaItem>
              columns={columns}
              rows={rows}
              rowKey={(m) => m.id}
              loading={isLoading}
              selectable
              selected={selected}
              onSelectionChange={setSelected}
              onRowClick={(m) => setSelectedId(m.id === selectedId ? null : m.id)}
              activeRowKey={selectedId}
              rowDim={(m) => !usage.get(m.id)}
              emptyState={empty}
              sort={undefined as SortState | undefined}
            />
          ) : rows.length === 0 && !isLoading ? (
            <Box sx={{ border: 1, borderColor: "surface.border", borderRadius: 2, bgcolor: "background.paper" }}>{empty}</Box>
          ) : (
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))", gap: 1.25 }}>
              {rows.map((m) => {
                const isSelected = selected.has(m.id);
                const isActive = selectedId === m.id;
                return (
                  <Box
                    key={m.id}
                    onClick={() => setSelectedId(isActive ? null : m.id)}
                    sx={(t) => ({
                      position: "relative",
                      border: 1,
                      borderColor: isActive ? "primary.main" : isSelected ? `${t.palette.primary.main}99` : "surface.border",
                      boxShadow: isActive ? `0 0 0 2px ${t.palette.primary.main}33` : "none",
                      borderRadius: 1.5,
                      bgcolor: "background.paper",
                      overflow: "hidden",
                      cursor: "pointer",
                      "&:hover": { borderColor: isActive ? "primary.main" : "surface.borderStrong" },
                      "&:hover .sel, &.has-sel .sel": { opacity: 1 },
                    })}
                    className={isSelected ? "has-sel" : undefined}
                  >
                    <MediaThumb media={m} width="100%" height={96} radius={0} />
                    <Box className="sel" sx={{ position: "absolute", top: 4, left: 4, opacity: isSelected ? 1 : 0, transition: "opacity .15s" }} onClick={(e) => e.stopPropagation()}>
                      <Checkbox size="small" checked={isSelected} onChange={() => toggleSelect(m.id)} sx={{ p: 0.25, bgcolor: "rgba(255,255,255,0.9)", borderRadius: 1, "&:hover": { bgcolor: "#fff" } }} slotProps={{ input: { "aria-label": `Select ${m.name}` } }} />
                    </Box>
                    {m.type === "Video" && (
                      <Box sx={{ position: "absolute", top: 76, right: 6, display: "flex", alignItems: "center", gap: 0.5, px: 0.75, borderRadius: 1, bgcolor: "rgba(0,0,0,0.65)", color: "#fff", fontSize: 11, fontWeight: 600 }}>
                        <PlayCircleOutlineRoundedIcon sx={{ fontSize: 13 }} />
                        {m.duration ? formatDuration(m.duration) : "video"}
                      </Box>
                    )}
                    <Box sx={{ p: 1 }}>
                      <Typography sx={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3 }} noWrap title={m.name}>
                        {m.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap component="div">
                        {formatBytes(m.size)}
                        {m.dimensions && m.dimensions !== "Unknown" ? ` · ${m.dimensions}` : ""}
                        {usage.get(m.id) ? ` · ${usage.get(m.id)} pl.` : ""}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}

          <BulkBar count={selected.size} noun="file" onClear={() => setSelected(new Set())} onSelectAll={() => setSelected(new Set(rows.map((m) => m.id)))} total={rows.length}>
            <Button
              variant="outlined"
              startIcon={<LabelOutlinedIcon />}
              onClick={() => {
                setCategoryOpen(true);
              }}
            >
              Set category
            </Button>
            <Tooltip title="Files used in playlists cannot be deleted until removed from them">
              <Button variant="outlined" color="error" startIcon={<DeleteOutlineRoundedIcon />} onClick={() => setDeleteIds([...selected])}>
                Delete
              </Button>
            </Tooltip>
          </BulkBar>
        </Box>

        {selectedItem && (
          <MediaDetailPanel
            key={selectedItem.id}
            media={selectedItem}
            playlists={playlists}
            onClose={() => setSelectedId(null)}
            onPrev={selectedIndex > 0 ? () => setSelectedId(rows[selectedIndex - 1].id) : undefined}
            onNext={selectedIndex >= 0 && selectedIndex < rows.length - 1 ? () => setSelectedId(rows[selectedIndex + 1].id) : undefined}
            position={selectedIndex >= 0 ? `${selectedIndex + 1} / ${rows.length}` : undefined}
            onDelete={(m) => setDeleteIds([m.id])}
          />
        )}
      </Box>

      {uploadOpen && <UploadDialog onClose={closeUpload} onUploaded={(created) => created.length === 1 && setSelectedId(created[0].id)} />}

      <ConfirmDialog open={Boolean(deleteIds)} title={deleteIds && deleteIds.length > 1 ? `Delete ${deleteIds.length} files?` : "Delete file?"} message={deleteIds ? deleteMessage(deleteIds) : ""} loading={deleteMedia.isPending} onConfirm={confirmDelete} onClose={() => setDeleteIds(null)} />

      <Dialog open={categoryOpen} onClose={() => setCategoryOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Set category for {selected.size} file{selected.size === 1 ? "" : "s"}</DialogTitle>
        <DialogContent>
          <TextField select fullWidth label="Category" value={categoryValue} onChange={(e) => setCategoryValue(e.target.value as MediaCategory)} sx={{ mt: 0.5 }}>
            {MEDIA_CATEGORIES.map((c) => (
              <MenuItem key={c} value={c}>
                {c}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setCategoryOpen(false)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={bulkCategory} disabled={updateMedia.isPending}>
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
