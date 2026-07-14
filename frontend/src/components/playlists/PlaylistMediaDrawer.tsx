import { Box, IconButton, InputAdornment, TextField, Typography, Paper } from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";
import { useState } from "react";

import type { MediaItem } from "../../types/media";

interface Props {
  mediaItems: MediaItem[];
  onAdd: (media: MediaItem) => void;
}

export default function PlaylistMediaDrawer({ mediaItems, onAdd }: Props) {
  const [search, setSearch] = useState("");

  const filtered = mediaItems.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", bgcolor: "#F8FAFC", borderLeft: "1px solid #E2E8F0" }}>
      <Box sx={{ p: 2, borderBottom: "1px solid #E2E8F0", bgcolor: "#fff" }}>
        <Typography sx={{ fontWeight: 700, fontSize: 16, mb: 1.5, color: "#1E293B" }}>Media Library</Typography>
        <TextField
          placeholder="Search media..."
          size="small"
          fullWidth
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: <InputAdornment position="start"><SearchRoundedIcon sx={{ fontSize: 18 }} /></InputAdornment>
            }
          }}
          sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px", bgcolor: "#F8FAFC" } }}
        />
      </Box>

      <Box sx={{ p: 1.5, flexGrow: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 1 }}>
        {filtered.map(media => (
          <Paper
            key={media.id}
            elevation={0}
            sx={{
              display: "flex",
              alignItems: "center",
              p: 1,
              borderRadius: "10px",
              border: "1px solid #E2E8F0",
              bgcolor: "#fff",
              gap: 1.5,
              "&:hover": { borderColor: "#CBD5E1" }
            }}
          >
            {/* Thumbnail Image */}
            <Box
              sx={{
                width: 64,
                height: 48,
                borderRadius: "6px",
                backgroundImage: `url(${media.thumbnail})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                flexShrink: 0,
                position: "relative",
              }}
            >
              {media.type === "Video" && (
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "rgba(0,0,0,0.3)",
                    borderRadius: "6px",
                  }}
                >
                  <PlayCircleOutlineRoundedIcon sx={{ color: "#fff", fontSize: 16 }} />
                </Box>
              )}
            </Box>

            {/* Media Metadata */}
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography noWrap sx={{ fontWeight: 600, fontSize: 13, color: "#1E293B", mb: 0.2 }}>
                {media.name}
              </Typography>
              <Typography sx={{ fontSize: 11, color: "#64748B" }}>
                {media.type} • {media.category}
              </Typography>
            </Box>

            {/* Add Action Button */}
            <IconButton
              size="small"
              onClick={() => onAdd(media)}
              sx={{
                color: "#10B981",
                bgcolor: "#ECFDF5",
                "&:hover": { bgcolor: "#D1FAE5" },
                borderRadius: "8px",
                p: 0.8
              }}
            >
              <AddRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Paper>
        ))}

        {filtered.length === 0 && (
          <Typography sx={{ color: "#64748B", textAlign: "center", mt: 4, fontSize: 13 }}>
            No media found.
          </Typography>
        )}
      </Box>
    </Box>
  );
}
