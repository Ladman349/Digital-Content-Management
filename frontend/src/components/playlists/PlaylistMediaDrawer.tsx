import { Box, Button, InputAdornment, TextField, Typography, Paper } from "@mui/material";
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
        <Typography sx={{ fontWeight: 700, fontSize: 16, mb: 2 }}>Media Library</Typography>
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

      <Box sx={{ p: 2, flexGrow: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 1.5 }}>
        {filtered.map(media => (
          <Paper
            key={media.id}
            elevation={0}
            sx={{
              display: "flex",
              flexDirection: "column",
              borderRadius: "12px",
              border: "1px solid #E2E8F0",
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                height: 100,
                backgroundImage: `url(${media.thumbnail})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
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
                  }}
                >
                  <PlayCircleOutlineRoundedIcon sx={{ color: "#fff", fontSize: 24 }} />
                </Box>
              )}
            </Box>
            <Box sx={{ p: 1.5 }}>
              <Typography sx={{ fontWeight: 600, fontSize: 13, color: "#1E293B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", mb: 0.5 }}>
                {media.name}
              </Typography>
              <Typography sx={{ fontSize: 11, color: "#64748B", mb: 1.5 }}>
                {media.type} • {media.category}
              </Typography>
              <Button
                fullWidth
                variant="outlined"
                size="small"
                startIcon={<AddRoundedIcon />}
                onClick={() => onAdd(media)}
                sx={{ borderRadius: "8px", textTransform: "none", fontWeight: 600 }}
              >
                Add to Sequence
              </Button>
            </Box>
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
