import { Box, IconButton, Paper, Typography, Tooltip, Skeleton, Chip } from "@mui/material";
import Grid from "@mui/material/Grid";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import OpenInFullRoundedIcon from "@mui/icons-material/OpenInFullRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import MovieRoundedIcon from "@mui/icons-material/MovieRounded";
import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";
import FilterListOffRoundedIcon from "@mui/icons-material/FilterListOffRounded";

import type { MediaItem } from "../../types/media";
import { formatBytes, formatDuration } from "./utils";
import EmptyState from "../common/EmptyState";
import { formatDate } from "../../utils/date";

interface Props {
  items: MediaItem[];
  loading?: boolean;
  hasActiveFilters?: boolean;
  onPreview: (item: MediaItem) => void;
  onDelete: (item: MediaItem) => void;
  onClearFilters?: () => void;
  onUpload?: () => void;
}

function MediaCardSkeleton() {
  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: "16px",
        border: "1px solid #EEF2F7",
        overflow: "hidden",
      }}
    >
      <Skeleton variant="rectangular" height={160} />
      <Box sx={{ p: 2 }}>
        <Skeleton width="80%" height={24} sx={{ mb: 1 }} />
        <Skeleton width="40%" height={16} sx={{ mb: 0.5 }} />
        <Skeleton width="60%" height={16} />
      </Box>
    </Paper>
  );
}

function MediaCard({
  item,
  onPreview,
  onDelete,
}: {
  item: MediaItem;
  onPreview: (item: MediaItem) => void;
  onDelete: (item: MediaItem) => void;
}) {
  const isVideo = item.type === "Video";
  const dateStr = formatDate(item.uploadedAt);

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
        "&:hover": {
          boxShadow: "0 12px 32px rgba(15,23,42,0.08)",
          transform: "translateY(-3px)",
          borderColor: "#E2E8F0",
          "& .media-actions": { opacity: 1 },
          "& .media-overlay": { opacity: 1 },
        },
      }}
    >
      {/* Thumbnail Area */}
      <Box
        onClick={() => onPreview(item)}
        sx={{
          position: "relative",
          height: { xs: 150, sm: 165 },
          bgcolor: "#0F172A",
          backgroundImage: item.thumbnail ? `url(${item.thumbnail})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          borderBottom: "1px solid #EEF2F6",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {!item.thumbnail && (
          <Box sx={{ color: "rgba(255,255,255,0.4)" }}>
            {isVideo ? <MovieRoundedIcon sx={{ fontSize: 48 }} /> : <ImageRoundedIcon sx={{ fontSize: 48 }} />}
          </Box>
        )}

        <Box
          className="media-overlay"
          sx={{
            position: "absolute",
            inset: 0,
            bgcolor: "rgba(15,23,42,0.45)",
            opacity: 0,
            transition: "opacity 0.2s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Box
            sx={{
              bgcolor: "rgba(255,255,255,0.25)",
              color: "#fff",
              backdropFilter: "blur(6px)",
              p: 1.25,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <OpenInFullRoundedIcon fontSize="small" />
          </Box>
        </Box>

        {/* Type Badge */}
        <Chip
          label={item.type.toUpperCase()}
          size="small"
          sx={{
            position: "absolute",
            top: 8,
            left: 8,
            height: 20,
            fontSize: 10,
            fontWeight: 700,
            bgcolor: isVideo ? "rgba(236, 72, 153, 0.9)" : "rgba(14, 165, 233, 0.9)",
            color: "#fff",
            backdropFilter: "blur(4px)",
          }}
        />

        {isVideo && (
          <Box
            sx={{
              position: "absolute",
              bottom: 8,
              right: 8,
              bgcolor: "rgba(15,23,42,0.8)",
              color: "#fff",
              px: 1,
              py: 0.25,
              borderRadius: "6px",
              fontSize: 11,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              backdropFilter: "blur(4px)",
            }}
          >
            <PlayCircleOutlineRoundedIcon sx={{ fontSize: 13 }} />
            {formatDuration(item.duration)}
          </Box>
        )}
      </Box>

      {/* Details Area */}
      <Box sx={{ p: { xs: 1.75, sm: 2 } }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: { xs: 13.5, sm: 14 },
              color: "#0F172A",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              mb: 0.5,
            }}
            title={item.name}
          >
            {item.name}
          </Typography>
        </Box>

        <Typography sx={{ color: "#64748B", fontSize: 12, fontWeight: 500, mb: 0.5 }}>
          {formatBytes(item.size)} {item.dimensions ? `• ${item.dimensions}` : ""}
        </Typography>

        <Typography sx={{ color: "#94A3B8", fontSize: 11.5 }}>
          {dateStr} {item.uploadedBy ? `by ${item.uploadedBy}` : ""}
        </Typography>

        <Box
          className="media-actions"
          sx={{
            position: "absolute",
            bottom: 8,
            right: 8,
            opacity: { xs: 1, md: 0 },
            transition: "opacity 0.2s ease",
          }}
        >
          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item);
              }}
              sx={{
                bgcolor: "#fff",
                border: "1px solid #E2E8F0",
                color: "#EF4444",
                boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                "&:hover": { bgcolor: "#FEF2F2", borderColor: "#FECACA" },
              }}
            >
              <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Paper>
  );
}

export default function MediaGrid({
  items,
  loading = false,
  hasActiveFilters = false,
  onPreview,
  onDelete,
  onClearFilters,
  onUpload,
}: Props) {
  if (loading) {
    return (
      <Grid container spacing={{ xs: 1.5, sm: 2, md: 3 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <MediaCardSkeleton />
          </Grid>
        ))}
      </Grid>
    );
  }

  if (items.length === 0) {
    return (
      <Paper
        elevation={0}
        sx={{
          borderRadius: "20px",
          border: "1px solid #EEF2F7",
          bgcolor: "#FFFFFF",
        }}
      >
        <EmptyState
          icon={hasActiveFilters ? FilterListOffRoundedIcon : ImageRoundedIcon}
          title={hasActiveFilters ? "No matching media" : "No media uploaded yet"}
          description={
            hasActiveFilters
              ? "No media files match your current search or filters. Try adjusting your criteria."
              : "Upload your first image or video to display on your digital signage screens."
          }
          actionLabel={hasActiveFilters ? "Clear filters" : "Upload Media"}
          onAction={hasActiveFilters ? onClearFilters : onUpload}
        />
      </Paper>
    );
  }

  return (
    <Grid container spacing={{ xs: 1.5, sm: 2, md: 3 }}>
      {items.map((item) => (
        <Grid key={item.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <MediaCard item={item} onPreview={onPreview} onDelete={onDelete} />
        </Grid>
      ))}
    </Grid>
  );
}
