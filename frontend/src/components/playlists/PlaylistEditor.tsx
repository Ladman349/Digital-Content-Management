import { useState, useEffect, useMemo } from "react";
import { Box, Button, TextField, Typography, MenuItem, IconButton } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import { useSnackbar } from "notistack";

import type { Playlist, PlaylistItem, PlaylistStatus } from "../../types/playlist";
import type { MediaItem } from "../../types/media";

import PlaylistTimeline from "./PlaylistTimeline";
import PlaylistMediaDrawer from "./PlaylistMediaDrawer";
import { formatDuration } from "./utils";

interface Props {
  open: boolean;
  initialPlaylist?: Playlist;
  mediaLibrary: MediaItem[];
  onClose: () => void;
  onSave: (playlist: Playlist) => void;
}

export default function PlaylistEditor({ open, initialPlaylist, mediaLibrary, onClose, onSave }: Props) {
  const { enqueueSnackbar } = useSnackbar();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<PlaylistStatus>("Draft");
  const [items, setItems] = useState<PlaylistItem[]>([]);

  useEffect(() => {
    if (open) {
      if (initialPlaylist) {
        setName(initialPlaylist.name);
        setDescription(initialPlaylist.description);
        setStatus(initialPlaylist.status);
        setItems(initialPlaylist.items);
      } else {
        setName("");
        setDescription("");
        setStatus("Draft");
        setItems([]);
      }
    }
  }, [open, initialPlaylist]);

  const totalDuration = useMemo(() => items.reduce((acc, item) => acc + item.duration, 0), [items]);

  if (!open) return null;

  const handleAddMedia = (media: MediaItem) => {
    if (items.some(i => i.mediaId === media.id)) {
      enqueueSnackbar("This media is already in the playlist.", { variant: "warning" });
      return;
    }
    const newItem: PlaylistItem = {
      id: `item-${Date.now()}`,
      mediaId: media.id,
      duration: media.type === "Video" ? (media.duration || 10) : 10,
    };
    setItems(prev => [...prev, newItem]);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setItems(prev => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[index - 1];
      copy[index - 1] = temp;
      return copy;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === items.length - 1) return;
    setItems(prev => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[index + 1];
      copy[index + 1] = temp;
      return copy;
    });
  };

  const handleRemove = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateDuration = (index: number, duration: number) => {
    setItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], duration };
      return copy;
    });
  };

  const handleSave = () => {
    if (!name.trim()) {
      enqueueSnackbar("Playlist name is required.", { variant: "error" });
      return;
    }
    if (items.length === 0) {
      enqueueSnackbar("Playlist must have at least one media item.", { variant: "error" });
      return;
    }
    if (items.some(i => i.duration <= 0)) {
      enqueueSnackbar("All items must have a duration greater than 0.", { variant: "error" });
      return;
    }

    const playlistToSave: Playlist = {
      id: initialPlaylist?.id || `PL-NEW-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      items,
      assignedDeviceIds: initialPlaylist?.assignedDeviceIds || [],
      totalDuration,
      status,
      updatedAt: Date.now(),
    };
    onSave(playlistToSave);
  };

  return (
    <Box sx={{ position: "fixed", inset: 0, bgcolor: "#F1F5F9", zIndex: 1200, display: "flex", flexDirection: "column" }}>
      {/* Top Bar */}
      <Box sx={{ height: 64, bgcolor: "#fff", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between", px: 3, flexShrink: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <IconButton onClick={onClose} edge="start"><CloseRoundedIcon /></IconButton>
          <Typography sx={{ fontWeight: 700, fontSize: 18, color: "#1E293B" }}>
            {initialPlaylist ? "Edit Playlist Sequence" : "Create New Playlist"}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography sx={{ fontWeight: 600, color: "#64748B", fontSize: 14 }}>
            Total Duration: <Box component="span" sx={{ color: "#10B981" }}>{formatDuration(totalDuration)}</Box>
          </Typography>
          <Button variant="contained" startIcon={<SaveRoundedIcon />} onClick={handleSave} sx={{ bgcolor: "#10B981", "&:hover": { bgcolor: "#059669" }, fontWeight: 700, borderRadius: "10px", textTransform: "none" }}>
            Save Playlist
          </Button>
        </Box>
      </Box>

      {/* Editor Body */}
      <Box sx={{ display: "flex", flexGrow: 1, overflow: "hidden" }}>
        
        {/* Left Drawer (Media Library) */}
        <Box sx={{ width: 320, flexShrink: 0, height: "100%" }}>
          <PlaylistMediaDrawer mediaItems={mediaLibrary} onAdd={handleAddMedia} />
        </Box>

        {/* Main Content (Timeline & Settings) */}
        <Box sx={{ flexGrow: 1, overflowY: "auto", p: 4, display: "flex", flexDirection: "column", gap: 4 }}>
          
          {/* Settings Section */}
          <Box sx={{ display: "flex", gap: 3, bgcolor: "#fff", p: 3, borderRadius: "16px", border: "1px solid #E2E8F0", flexDirection: { xs: "column", md: "row" } }}>
            <Box sx={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 2 }}>
              <TextField
                label="Playlist Name"
                fullWidth
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
              />
              <TextField
                label="Description"
                fullWidth
                multiline
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
              />
            </Box>
            <Box sx={{ width: { xs: "100%", md: 200 } }}>
              <TextField
                select
                label="Status"
                fullWidth
                value={status}
                onChange={(e) => setStatus(e.target.value as PlaylistStatus)}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
              >
                <MenuItem value="Draft">Draft</MenuItem>
                <MenuItem value="Published">Published</MenuItem>
                <MenuItem value="Archived">Archived</MenuItem>
              </TextField>
            </Box>
          </Box>

          {/* Timeline Section */}
          <Box sx={{ flexGrow: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 18, color: "#1E293B", mb: 2 }}>
              Playback Sequence
            </Typography>
            <PlaylistTimeline
              items={items}
              mediaLibrary={mediaLibrary}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onRemove={handleRemove}
              onUpdateDuration={handleUpdateDuration}
            />
          </Box>

        </Box>
      </Box>
    </Box>
  );
}
