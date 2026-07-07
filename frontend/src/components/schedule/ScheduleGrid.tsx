import { Box, IconButton, Paper, Typography, Tooltip, Skeleton, Chip } from "@mui/material";
import Grid from "@mui/material/Grid";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import FilterListOffRoundedIcon from "@mui/icons-material/FilterListOffRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import TvRoundedIcon from "@mui/icons-material/TvRounded";
import FormatListBulletedRoundedIcon from "@mui/icons-material/FormatListBulletedRounded";
import DateRangeRoundedIcon from "@mui/icons-material/DateRangeRounded";

import type { Schedule, ScheduleStatus, SchedulePriority } from "../../types/schedule";
import type { Playlist } from "../../types/playlist";
import EmptyState from "../common/EmptyState";
interface Props {
  playlists: Playlist[];
  schedules: Schedule[];
  conflictingIds: string[];
  loading?: boolean;
  hasActiveFilters?: boolean;
  onEdit: (schedule: Schedule) => void;
  onDuplicate: (schedule: Schedule) => void;
  onPreview: (schedule: Schedule) => void;
  onDelete: (schedule: Schedule) => void;
  onClearFilters?: () => void;
  onCreate?: () => void;
}

const statusColors: Record<ScheduleStatus, { bg: string; text: string; border: string }> = {
  Active: { bg: "#F0FDF4", text: "#15803D", border: "#BBF7D0" },
  Draft: { bg: "#FFFBEB", text: "#B45309", border: "#FDE68A" },
  Paused: { bg: "#F1F5F9", text: "#475569", border: "#E2E8F0" },
  Expired: { bg: "#FEF2F2", text: "#B91C1C", border: "#FECACA" },
};

const priorityColors: Record<SchedulePriority, string> = {
  Emergency: "#EF4444",
  High: "#F59E0B",
  Normal: "#3B82F6",
  Low: "#94A3B8",
};

function ScheduleCard({
  schedule,
  playlists,
  hasConflict,
  onEdit,
  onDuplicate,
  onPreview,
  onDelete,
}: {
  schedule: Schedule;
  playlists: Playlist[];
  hasConflict: boolean;
  onEdit: (schedule: Schedule) => void;
  onDuplicate: (schedule: Schedule) => void;
  onPreview: (schedule: Schedule) => void;
  onDelete: (schedule: Schedule) => void;
}) {
  const colors = statusColors[schedule.status];
  const pColor = priorityColors[schedule.priority];
  const playlist = playlists.find(p => p.id === schedule.playlistId);

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: "16px",
        border: "1px solid",
        borderColor: hasConflict ? "#FECACA" : "#EEF2F7",
        overflow: "hidden",
        position: "relative",
        transition: "all 0.2s ease",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        "&:hover": {
          boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
          transform: "translateY(-4px)",
        },
      }}
    >
      {/* Top Banner indicating Priority / Conflict */}
      <Box sx={{ height: 4, bgcolor: hasConflict ? "#EF4444" : pColor }} />

      {/* Content */}
      <Box sx={{ p: 2.5, display: "flex", flexDirection: "column", flexGrow: 1 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: "#111827", lineHeight: 1.3 }}>
              {schedule.name}
            </Typography>
            {hasConflict && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "#EF4444", mt: 0.5 }}>
                <WarningRoundedIcon sx={{ fontSize: 14 }} />
                <Typography sx={{ fontSize: 12, fontWeight: 600 }}>Device Conflict</Typography>
              </Box>
            )}
          </Box>
          <Chip
            label={schedule.status}
            size="small"
            sx={{
              bgcolor: colors.bg,
              color: colors.text,
              border: `1px solid ${colors.border}`,
              fontWeight: 600,
              fontSize: 11,
              height: 22,
            }}
          />
        </Box>

        {/* Schedule Info Grid */}
        <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 1.5, flexGrow: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "#64748B" }}>
            <DateRangeRoundedIcon sx={{ fontSize: 16 }} />
            <Typography sx={{ fontSize: 13, fontWeight: 500 }}>
              {schedule.startDate} to {schedule.endDate}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "#64748B" }}>
            <AccessTimeRoundedIcon sx={{ fontSize: 16 }} />
            <Typography sx={{ fontSize: 13, fontWeight: 500 }}>
              {schedule.startTime} - {schedule.endTime} • {schedule.repeat}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "#64748B" }}>
            <FormatListBulletedRoundedIcon sx={{ fontSize: 16 }} />
            <Typography sx={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {playlist?.name || "Unknown Playlist"}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "#64748B" }}>
            <TvRoundedIcon sx={{ fontSize: 16 }} />
            <Typography sx={{ fontSize: 13, fontWeight: 500 }}>
              {schedule.deviceIds.length} target devices
            </Typography>
          </Box>
        </Box>

        {/* Actions & Meta */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pt: 2, mt: 2, borderTop: "1px solid #F1F5F9" }}>
          <Typography sx={{ color: pColor, fontSize: 12, fontWeight: 600 }}>
            {schedule.priority} Priority
          </Typography>
          
          <Box sx={{ display: "flex", gap: 0.5 }}>
            <Tooltip title="Preview">
              <IconButton size="small" onClick={() => onPreview(schedule)} sx={{ color: "#3B82F6" }}>
                <FormatListBulletedRoundedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Duplicate">
              <IconButton size="small" onClick={() => onDuplicate(schedule)} sx={{ color: "#64748B" }}>
                <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Edit">
              <IconButton size="small" onClick={() => onEdit(schedule)} sx={{ color: "#F59E0B" }}>
                <EditRoundedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton size="small" onClick={() => onDelete(schedule)} sx={{ color: "#EF4444" }}>
                <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}

export default function ScheduleGrid({
  playlists,
  schedules,
  conflictingIds,
  loading = false,
  hasActiveFilters = false,
  onEdit,
  onDuplicate,
  onPreview,
  onDelete,
  onClearFilters,
  onCreate,
}: Props) {
  if (loading) {
    return (
      <Grid container spacing={3}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, lg: 4 }}>
            <Skeleton variant="rectangular" height={240} sx={{ borderRadius: "16px" }} />
          </Grid>
        ))}
      </Grid>
    );
  }

  if (schedules.length === 0) {
    return (
      <Paper elevation={0} sx={{ borderRadius: "20px", border: "1px solid #EEF2F7", bgcolor: "#FFFFFF" }}>
        <EmptyState
          icon={hasActiveFilters ? FilterListOffRoundedIcon : CalendarMonthRoundedIcon}
          title={hasActiveFilters ? "No matching schedules" : "No schedules configured"}
          description={
            hasActiveFilters
              ? "No schedules match your current search or filters. Try adjusting your criteria."
              : "Create your first schedule to automate media playback on your devices."
          }
          actionLabel={hasActiveFilters ? "Clear filters" : "Create Schedule"}
          onAction={hasActiveFilters ? onClearFilters : onCreate}
        />
      </Paper>
    );
  }

  return (
    <Grid container spacing={3}>
      {schedules.map((schedule) => (
        <Grid key={schedule.id} size={{ xs: 12, sm: 6, lg: 4 }}>
          <ScheduleCard
            schedule={schedule}
            playlists={playlists}
            hasConflict={conflictingIds.includes(schedule.id)}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onPreview={onPreview}
            onDelete={onDelete}
          />
        </Grid>
      ))}
    </Grid>
  );
}
