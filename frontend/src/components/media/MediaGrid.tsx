import { Box, IconButton, Paper, Typography, Tooltip, Skeleton } from "@mui/material";
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
        border: "1px solid #EEF2F7",
        overflow: "hidden",
        position: "relative",
        transition: "all 0.2s ease",
        "&:hover": {
          boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
          transform: "translateY(-4px)",
          "& .media-actions": { opacity: 1 },
          "& .media-overlay": { opacity: 1 },
        },
      }}
    >
      {/* Thumbnail Area */}
      <Box
        sx={{
          position: "relative",
          height: 160,
          bgcolor: "#F8FAFC",
          backgroundImage: `url(${item.thumbnail})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          borderBottom: "1px solid #EEF2F7",
        }}
      >
        <Box
          className="media-overlay"
          sx={{
            position: "absolute",
            inset: 0,
            bgcolor: "rgba(15,23,42,0.4)",
            opacity: 0,
            transition: "opacity 0.2s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconButton
            onClick={() => onPreview(item)}
            sx={{
              bgcolor: "rgba(255,255,255,0.2)",
              color: "#fff",
              backdropFilter: "blur(4px)",
              "&:hover": { bgcolor: "rgba(255,255,255,0.3)" },
            }}
          >
            <OpenInFullRoundedIcon />
          </IconButton>
        </Box>

        {isVideo && (
          <Box
            sx={{
              position: "absolute",
              bottom: 8,
              right: 8,
              bgcolor: "rgba(15,23,42,0.7)",
              color: "#fff",
              px: 1,
              py: 0.25,
              borderRadius: "6px",
              fontSize: 11,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              backdropFilter: "blur(4px)",
            }}
          >
            <PlayCircleOutlineRoundedIcon sx={{ fontSize: 14 }} />
            {formatDuration(item.duration)}
          </Box>
        )}
      </Box>

      {/* Details Area */}
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: 14,
              color: "#111827",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              mb: 0.5,
            }}
            title={item.name}
          >
            {item.name}
          </Typography>
          {isVideo ? (
            <MovieRoundedIcon sx={{ fontSize: 16, color: "#94A3B8", flexShrink: 0 }} />
          ) : (
            <ImageRoundedIcon sx={{ fontSize: 16, color: "#94A3B8", flexShrink: 0 }} />
          )}
        </Box>

        <Typography sx={{ color: "#64748B", fontSize: 12, mb: 0.5 }}>
          {formatBytes(item.size)} • {item.dimensions}
        </Typography>

        <Typography sx={{ color: "#94A3B8", fontSize: 12 }}>
          {dateStr} by {item.uploadedBy}
        </Typography>

        <Box
          className="media-actions"
          sx={{
            position: "absolute",
            bottom: 8,
            right: 8,
            opacity: 0,
            transition: "opacity 0.2s ease",
          }}
        >
          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={() => onDelete(item)}
              sx={{
                bgcolor: "#fff",
                border: "1px solid #E5E7EB",
                color: "#EF4444",
                boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
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
      <Grid container spacing={3}>
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
    <Grid container spacing={3}>
      {items.map((item) => (
        <Grid key={item.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <MediaCard item={item} onPreview={onPreview} onDelete={onDelete} />
        </Grid>
      ))}
    </Grid>
  );
}
