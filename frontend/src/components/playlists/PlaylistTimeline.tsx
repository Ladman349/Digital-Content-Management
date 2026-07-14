import { Box, IconButton, Paper, Typography, TextField } from "@mui/material";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";

import type { PlaylistItem } from "../../types/playlist";
import type { MediaItem } from "../../types/media";

interface Props {
  items: PlaylistItem[];
  mediaLibrary: MediaItem[];
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRemove: (index: number) => void;
  onUpdateDuration: (index: number, duration: number) => void;
}

export default function PlaylistTimeline({
  items,
  mediaLibrary,
  onMoveUp,
  onMoveDown,
  onRemove,
  onUpdateDuration,
}: Props) {
  if (items.length === 0) {
    return (
      <Box
        sx={{
          border: "2px dashed #E2E8F0",
          borderRadius: "16px",
          p: 6,
          textAlign: "center",
          bgcolor: "#F8FAFC",
        }}
      >
        <Typography sx={{ color: "#64748B", fontWeight: 600 }}>
          Timeline is empty. Select media from the library to add.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {items.map((item, index) => {
        const media = mediaLibrary.find((m) => m.id === item.mediaId);
        if (!media) return null;

        const isFirst = index === 0;
        const isLast = index === items.length - 1;

        return (
          <Paper
            key={item.id}
            elevation={0}
            sx={{
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              alignItems: { xs: "stretch", sm: "center" },
              p: 1.5,
              borderRadius: "12px",
              border: "1px solid #EEF2F7",
              bgcolor: "#fff",
              gap: { xs: 1.5, sm: 2 },
            }}
          >
            {/* Upper row: Thumbnail + Details + Delete (Mobile only) */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexGrow: 1, minWidth: 0 }}>
              {/* Vertical Reorder Arrows (Desktop only) */}
              <Box sx={{ display: { xs: "none", sm: "flex" }, flexDirection: "column", gap: 0.5, color: "#CBD5E1" }}>
                <IconButton size="small" disabled={isFirst} onClick={() => onMoveUp(index)}>
                  <ArrowUpwardRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
                <IconButton size="small" disabled={isLast} onClick={() => onMoveDown(index)}>
                  <ArrowDownwardRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>

              <Box
                sx={{
                  width: 80,
                  height: 56,
                  borderRadius: "8px",
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
                      borderRadius: "8px",
                    }}
                  >
                    <PlayCircleOutlineRoundedIcon sx={{ color: "#fff", fontSize: 20 }} />
                  </Box>
                )}
              </Box>

              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600, fontSize: 14, color: "#1E293B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {media.name}
                </Typography>
                <Typography sx={{ fontSize: 12, color: "#64748B" }}>
                  {media.type} • {media.category}
                </Typography>
              </Box>

              {/* Delete Icon (Mobile only) */}
              <IconButton onClick={() => onRemove(index)} sx={{ display: { xs: "inline-flex", sm: "none" }, color: "#EF4444", "&:hover": { bgcolor: "#FEF2F2" } }}>
                <DeleteOutlineRoundedIcon />
              </IconButton>
            </Box>

            {/* Lower row / Actions row (Mobile & Desktop) */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 2,
                borderTop: { xs: "1px solid #F1F5F9", sm: "none" },
                pt: { xs: 1.5, sm: 0 },
              }}
            >
              {/* Horizontal Reorder Arrows (Mobile only) */}
              <Box sx={{ display: { xs: "flex", sm: "none" }, alignItems: "center", gap: 1 }}>
                <IconButton size="small" disabled={isFirst} onClick={() => onMoveUp(index)}>
                  <ArrowUpwardRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
                <IconButton size="small" disabled={isLast} onClick={() => onMoveDown(index)}>
                  <ArrowDownwardRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", gap: 1, ml: { xs: "auto", sm: 0 } }}>
                <Typography sx={{ fontSize: 12, color: "#64748B", fontWeight: 500 }}>
                  Duration (s):
                </Typography>
                <TextField
                  type="number"
                  size="small"
                  value={item.duration}
                  onChange={(e) => onUpdateDuration(index, parseInt(e.target.value) || 0)}
                  sx={{
                    width: 80,
                    "& .MuiOutlinedInput-root": { borderRadius: "8px" },
                    "& input": { textAlign: "center", py: 1 },
                  }}
                />
              </Box>

              {/* Delete Icon (Desktop only) */}
              <IconButton onClick={() => onRemove(index)} sx={{ display: { xs: "none", sm: "inline-flex" }, color: "#EF4444", "&:hover": { bgcolor: "#FEF2F2" } }}>
                <DeleteOutlineRoundedIcon />
              </IconButton>
            </Box>
          </Paper>
        );
      })}
    </Box>
  );
}
