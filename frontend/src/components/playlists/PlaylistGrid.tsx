import { Box, IconButton, Paper, Typography, Tooltip, Skeleton, Chip } from "@mui/material";
import Grid from "@mui/material/Grid";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";
import FilterListOffRoundedIcon from "@mui/icons-material/FilterListOffRounded";
import FormatListBulletedRoundedIcon from "@mui/icons-material/FormatListBulletedRounded";
import TvRoundedIcon from "@mui/icons-material/TvRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";

import type { Playlist, PlaylistStatus } from "../../types/playlist";
import type { MediaItem } from "../../types/media";
import { formatDuration } from "./utils";
import EmptyState from "../common/EmptyState";
import { formatDate } from "../../utils/date";

interface Props {
  mediaItems: MediaItem[];
  playlists: Playlist[];
  loading?: boolean;
  hasActiveFilters?: boolean;
  onEdit: (playlist: Playlist) => void;
  onPreview: (playlist: Playlist) => void;
  onDelete: (playlist: Playlist) => void;
  onClearFilters?: () => void;
  onCreate?: () => void;
}

const statusColors: Record<PlaylistStatus, { bg: string; text: string; border: string }> = {
  Published: { bg: "#F0FDF4", text: "#15803D", border: "#BBF7D0" },
  Draft: { bg: "#FFFBEB", text: "#B45309", border: "#FDE68A" },
  Archived: { bg: "#F8FAFC", text: "#475569", border: "#E2E8F0" },
};

function PlaylistCard({
  playlist,
  mediaItems,
  onEdit,
  onPreview,
  onDelete,
}: {
  playlist: Playlist;
  mediaItems: MediaItem[];
  onEdit: (playlist: Playlist) => void;
  onPreview: (playlist: Playlist) => void;
  onDelete: (playlist: Playlist) => void;
}) {
  const dateStr = formatDate(playlist.updatedAt);

  // Fetch thumbnails for up to the first 3 items
  const thumbnails = playlist.items.slice(0, 3).map((item) => {
    const media = mediaItems.find((m) => m.id === item.mediaId);
    return media?.thumbnail || "";
  });

  const colors = statusColors[playlist.status];

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: "16px",
        border: "1px solid #EEF2F6",
        overflow: "hidden",
        position: "relative",
        bgcolor: "#FFFFFF",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        "&:hover": {
          boxShadow: "0 12px 32px rgba(15,23,42,0.08)",
          transform: "translateY(-3px)",
          borderColor: "#E2E8F0",
        },
      }}
    >
      {/* Thumbnails strip */}
      <Box sx={{ display: "flex", height: { xs: 100, sm: 120 }, bgcolor: "#F1F5F9" }}>
        {thumbnails.length > 0 ? (
          thumbnails.map((thumb, idx) => (
            <Box
              key={idx}
              sx={{
                flex: 1,
                backgroundImage: `url(${thumb})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                borderRight: idx < thumbnails.length - 1 ? "2px solid #fff" : "none",
              }}
            />
          ))
        ) : (
          <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FormatListBulletedRoundedIcon sx={{ color: "#CBD5E1", fontSize: 40 }} />
          </Box>
        )}
      </Box>

      {/* Content */}
      <Box sx={{ p: { xs: 1.75, sm: 2 }, display: "flex", flexDirection: "column", flexGrow: 1 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1, gap: 1 }}>
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: { xs: 14, sm: 15 },
              color: "#0F172A",
              lineHeight: 1.3,
            }}
          >
            {playlist.name}
          </Typography>
          <Chip
            label={playlist.status}
            size="small"
            sx={{
              bgcolor: colors.bg,
              color: colors.text,
              border: `1px solid ${colors.border}`,
              fontWeight: 700,
              fontSize: 10.5,
              height: 22,
            }}
          />
        </Box>

        <Typography
          sx={{
            color: "#64748B",
            fontSize: 12.5,
            mb: 1.5,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            flexGrow: 1,
            lineHeight: 1.4,
          }}
        >
          {playlist.description || "No description provided."}
        </Typography>

        {/* Metrics */}
        <Box sx={{ display: "flex", gap: 1.5, mb: 1.5, flexWrap: "wrap" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "#64748B" }}>
            <ScheduleRoundedIcon sx={{ fontSize: 15 }} />
            <Typography sx={{ fontSize: 11.5, fontWeight: 600 }}>
              {formatDuration(playlist.totalDuration)}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "#64748B" }}>
            <FormatListBulletedRoundedIcon sx={{ fontSize: 15 }} />
            <Typography sx={{ fontSize: 11.5, fontWeight: 600 }}>
              {playlist.items.length} items
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "#64748B" }}>
            <TvRoundedIcon sx={{ fontSize: 15 }} />
            <Typography sx={{ fontSize: 11.5, fontWeight: 600 }}>
              {playlist.assignedDeviceIds.length} screens
            </Typography>
          </Box>
        </Box>

        {/* Actions & Meta */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pt: 1.25, borderTop: "1px solid #F1F5F9" }}>
          <Typography sx={{ color: "#94A3B8", fontSize: 11 }}>
            Updated {dateStr}
          </Typography>
          
          <Box sx={{ display: "flex", gap: 0.5 }}>
            <Tooltip title="Preview">
              <IconButton size="small" onClick={() => onPreview(playlist)} sx={{ color: "#3B82F6", p: 0.5 }}>
                <PlayCircleOutlineRoundedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Edit Sequence">
              <IconButton size="small" onClick={() => onEdit(playlist)} sx={{ color: "#10B981", p: 0.5 }}>
                <EditRoundedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton size="small" onClick={() => onDelete(playlist)} sx={{ color: "#EF4444", p: 0.5 }}>
                <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}

export default function PlaylistGrid({
  playlists,
  mediaItems,
  loading = false,
  hasActiveFilters = false,
  onEdit,
  onPreview,
  onDelete,
  onClearFilters,
  onCreate,
}: Props) {
  if (loading) {
    return (
      <Grid container spacing={{ xs: 1.5, sm: 2, md: 3 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, lg: 4 }}>
            <Skeleton variant="rectangular" height={260} sx={{ borderRadius: "16px" }} />
          </Grid>
        ))}
      </Grid>
    );
  }

  if (playlists.length === 0) {
    return (
      <Paper elevation={0} sx={{ borderRadius: "20px", border: "1px solid #EEF2F7", bgcolor: "#FFFFFF" }}>
        <EmptyState
          icon={hasActiveFilters ? FilterListOffRoundedIcon : FormatListBulletedRoundedIcon}
          title={hasActiveFilters ? "No matching playlists" : "No playlists created"}
          description={
            hasActiveFilters
              ? "No playlists match your current search or filters. Try adjusting your criteria."
              : "Create your first playlist to begin sequencing media for your digital signage."
          }
          actionLabel={hasActiveFilters ? "Clear filters" : "Create Playlist"}
          onAction={hasActiveFilters ? onClearFilters : onCreate}
        />
      </Paper>
    );
  }

  return (
    <Grid container spacing={{ xs: 1.5, sm: 2, md: 3 }}>
      {playlists.map((playlist) => (
        <Grid key={playlist.id} size={{ xs: 12, sm: 6, lg: 4 }}>
          <PlaylistCard playlist={playlist} mediaItems={mediaItems} onEdit={onEdit} onPreview={onPreview} onDelete={onDelete} />
        </Grid>
      ))}
    </Grid>
  );
}
