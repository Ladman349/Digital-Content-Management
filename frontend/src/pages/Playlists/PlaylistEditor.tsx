import { useMemo, useRef, useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, MenuItem, TextField, Tooltip, Typography } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { useSnackbar } from "notistack";
import type { MediaItem } from "../../types/media";
import type { Playlist, PlaylistItem, PlaylistStatus } from "../../types/playlist";
import MediaThumb from "../../components/ui/MediaThumb";
import EmptyState from "../../components/ui/EmptyState";
import PermMediaRoundedIcon from "@mui/icons-material/PermMediaRounded";
import { formatDuration, pluralize } from "../../utils/format";

interface Props {
  playlist?: Playlist | null;
  mediaLibrary: MediaItem[];
  saving?: boolean;
  onClose: () => void;
  onSave: (data: { name: string; description: string; status: PlaylistStatus; items: PlaylistItem[]; totalDuration: number }) => void;
}

const DEFAULT_IMAGE_SECONDS = 10;

/**
 * Full-screen playlist editor: media library on the left, ordered sequence on the right.
 * Items can be reordered by drag or with the keyboard-accessible arrow buttons.
 * The parent mounts this only while open, so the draft always starts from the given playlist.
 */
export default function PlaylistEditor({ playlist, mediaLibrary, saving, onClose, onSave }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [name, setName] = useState(playlist?.name ?? "");
  const [description, setDescription] = useState(playlist?.description ?? "");
  const [status, setStatus] = useState<PlaylistStatus>(playlist?.status ?? "Draft");
  const [items, setItems] = useState<PlaylistItem[]>(() => (playlist?.items ? [...playlist.items] : []));
  const [search, setSearch] = useState("");
  const dragIndex = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const mediaById = useMemo(() => new Map(mediaLibrary.map((m) => [m.id, m])), [mediaLibrary]);
  const usedIds = useMemo(() => new Set(items.map((i) => i.mediaId)), [items]);
  const total = useMemo(() => items.reduce((s, i) => s + (i.duration || 0), 0), [items]);

  const filteredLibrary = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mediaLibrary.filter((m) => !q || m.name.toLowerCase().includes(q));
  }, [mediaLibrary, search]);

  const add = (media: MediaItem) => {
    if (usedIds.has(media.id)) {
      enqueueSnackbar("The server does not allow the same file twice in one playlist", { variant: "warning" });
      return;
    }
    setItems((prev) => [...prev, { id: `item-${Date.now()}-${prev.length}`, mediaId: media.id, duration: media.type === "Video" && media.duration ? media.duration : DEFAULT_IMAGE_SECONDS }]);
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    setItems((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(from, 1);
      copy.splice(to, 0, moved);
      return copy;
    });
  };

  const setDuration = (index: number, value: number) => setItems((prev) => prev.map((it, i) => (i === index ? { ...it, duration: value } : it)));
  const removeAt = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  const save = () => {
    if (!name.trim()) {
      enqueueSnackbar("Give the playlist a name", { variant: "error" });
      return;
    }
    if (items.length === 0) {
      enqueueSnackbar("Add at least one item", { variant: "error" });
      return;
    }
    if (items.some((i) => !i.duration || i.duration <= 0)) {
      enqueueSnackbar("Every item needs a duration above zero", { variant: "error" });
      return;
    }
    onSave({ name: name.trim(), description: description.trim(), status, items, totalDuration: total });
  };

  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="lg" slotProps={{ paper: { sx: { height: "min(88vh, 860px)" } } }}>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        {playlist ? "Edit playlist" : "New playlist"}
        <Box sx={{ flex: 1 }} />
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
          {pluralize(items.length, "item")} · {formatDuration(total)} total
        </Typography>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0, display: "flex", minHeight: 0 }}>
        {/* Library */}
        <Box sx={{ width: 300, flexShrink: 0, borderRight: 1, borderColor: "surface.border", display: { xs: "none", md: "flex" }, flexDirection: "column", minHeight: 0 }}>
          <Box sx={{ p: 1.25, borderBottom: 1, borderColor: "surface.border" }}>
            <TextField
              fullWidth
              placeholder="Search media…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon sx={{ fontSize: 18, color: "text.disabled" }} /></InputAdornment> } }}
            />
          </Box>
          <Box sx={{ flex: 1, overflowY: "auto", p: 1, display: "grid", gap: 0.5, alignContent: "start" }}>
            {filteredLibrary.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
                {mediaLibrary.length === 0 ? "Upload media first." : "No media matches."}
              </Typography>
            )}
            {filteredLibrary.map((m) => {
              const used = usedIds.has(m.id);
              return (
                <Box key={m.id} sx={{ display: "flex", alignItems: "center", gap: 1, p: 0.75, borderRadius: 1.5, border: 1, borderColor: "surface.border", opacity: used ? 0.5 : 1 }}>
                  <MediaThumb media={m} width={44} height={28} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 600 }} noWrap title={m.name}>
                      {m.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {m.type}
                      {m.type === "Video" && m.duration ? ` · ${formatDuration(m.duration)}` : ""}
                    </Typography>
                  </Box>
                  <Tooltip title={used ? "Already in this playlist" : "Add to sequence"}>
                    <span>
                      <IconButton onClick={() => add(m)} disabled={used} aria-label={`Add ${m.name}`}>
                        <AddRoundedIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Sequence */}
        <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <Box sx={{ p: 2, display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "2fr 1fr" }, borderBottom: 1, borderColor: "surface.border" }}>
            <TextField label="Playlist name" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
            <TextField select label="Status" value={status} onChange={(e) => setStatus(e.target.value as PlaylistStatus)} helperText="Only Published playlists can be scheduled">
              <MenuItem value="Draft">Draft</MenuItem>
              <MenuItem value="Published">Published</MenuItem>
              <MenuItem value="Archived">Archived</MenuItem>
            </TextField>
            <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} sx={{ gridColumn: { sm: "1 / -1" } }} />
          </Box>

          <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>
            {items.length === 0 ? (
              <EmptyState icon={PermMediaRoundedIcon} title="Empty sequence" description="Add media from the library on the left. Items play top to bottom, then loop." compact />
            ) : (
              <Box sx={{ display: "grid", gap: 0.75 }}>
                {items.map((item, index) => {
                  const media = mediaById.get(item.mediaId);
                  return (
                    <Box
                      key={item.id}
                      draggable
                      onDragStart={() => (dragIndex.current = index)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(index);
                      }}
                      onDragLeave={() => setDragOver((d) => (d === index ? null : d))}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragIndex.current !== null) move(dragIndex.current, index);
                        dragIndex.current = null;
                        setDragOver(null);
                      }}
                      onDragEnd={() => {
                        dragIndex.current = null;
                        setDragOver(null);
                      }}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.25,
                        p: 1,
                        borderRadius: 1.5,
                        border: 1,
                        borderColor: dragOver === index ? "primary.main" : "surface.border",
                        bgcolor: "background.paper",
                      }}
                    >
                      <DragIndicatorRoundedIcon sx={{ fontSize: 18, color: "text.disabled", cursor: "grab" }} />
                      <Typography variant="caption" color="text.secondary" sx={{ width: 18, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {index + 1}
                      </Typography>
                      <MediaThumb media={media} width={56} height={34} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 600 }} noWrap>
                          {media?.name ?? `Missing media ${item.mediaId}`}
                        </Typography>
                        <Typography variant="caption" color={media ? "text.secondary" : "error.main"}>
                          {media ? `${media.type} · ${media.category}` : "This file no longer exists; remove it before saving"}
                        </Typography>
                      </Box>
                      <TextField
                        type="number"
                        value={item.duration}
                        onChange={(e) => setDuration(index, Math.max(0, parseInt(e.target.value, 10) || 0))}
                        sx={{ width: 104 }}
                        slotProps={{ input: { endAdornment: <InputAdornment position="end">s</InputAdornment> }, htmlInput: { min: 1, "aria-label": "Duration in seconds" } }}
                      />
                      <Box sx={{ display: "flex" }}>
                        <IconButton onClick={() => move(index, index - 1)} disabled={index === 0} aria-label="Move up">
                          <ArrowUpwardRoundedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                        <IconButton onClick={() => move(index, index + 1)} disabled={index === items.length - 1} aria-label="Move down">
                          <ArrowDownwardRoundedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                        <IconButton onClick={() => removeAt(index)} sx={{ color: "error.main" }} aria-label="Remove item">
                          <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={save} disabled={saving}>
          {saving ? "Saving…" : playlist ? "Save changes" : "Create playlist"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
