import { Box, Button, Chip, MenuItem, TextField, Typography } from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { Link as RouterLink } from "react-router-dom";
import { useSnackbar } from "notistack";
import type { Schedule, ScheduleStatus } from "../../types/schedule";
import type { Playlist } from "../../types/playlist";
import type { Device } from "../../types/device";
import DetailPanel from "../../components/ui/DetailPanel";
import Field, { FieldGrid, Section } from "../../components/ui/Field";
import StatusChip from "../../components/ui/StatusChip";
import OwnerSection from "../../components/ui/OwnerSection";
import { useUpdateSchedule } from "../../hooks/queries";
import { findConflicts, isScheduleExpired, isScheduleLiveNow } from "../../utils/schedule";
import { formatDate } from "../../utils/format";

interface Props {
  schedule: Schedule | null;
  playlists: Playlist[];
  devices: Device[];
  allSchedules: Schedule[];
  now: number;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  position?: string;
  onEdit: (s: Schedule) => void;
  onDuplicate: (s: Schedule) => void;
  onDelete: (s: Schedule) => void;
}

export default function ScheduleDetailPanel({ schedule, playlists, devices, allSchedules, now, onClose, onPrev, onNext, position, onEdit, onDuplicate, onDelete }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const update = useUpdateSchedule();

  if (!schedule) return null;

  const playlist = playlists.find((p) => p.id === schedule.playlistId);
  const targets = devices.filter((d) => schedule.deviceIds.includes(d.id));
  const live = isScheduleLiveNow(schedule, new Date(now));
  const expired = isScheduleExpired(schedule, new Date(now));
  const conflicts = findConflicts(allSchedules, schedule);

  const changeStatus = (status: ScheduleStatus) =>
    update.mutate(
      { id: schedule.id, data: { status } },
      { onSuccess: () => enqueueSnackbar(`Schedule is now ${status}`, { variant: "success" }), onError: (e) => enqueueSnackbar((e as Error).message, { variant: "error" }) },
    );

  return (
    <DetailPanel
      open
      onClose={onClose}
      onPrev={onPrev}
      onNext={onNext}
      position={position}
      title={schedule.name}
      subtitle={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <StatusChip label={schedule.status} />
          {live && <StatusChip label="Live now" tone="success" pulse />}
          {expired && schedule.status === "Active" && <StatusChip label="Past end date" tone="error" />}
          <StatusChip label={schedule.priority} dot={false} />
        </Box>
      }
      actions={
        <>
          <Button variant="outlined" color="error" startIcon={<DeleteOutlineRoundedIcon />} onClick={() => onDelete(schedule)}>
            Delete
          </Button>
          <Button variant="outlined" startIcon={<ContentCopyRoundedIcon />} onClick={() => onDuplicate(schedule)}>
            Duplicate
          </Button>
          <Button variant="contained" startIcon={<EditOutlinedIcon />} onClick={() => onEdit(schedule)}>
            Edit
          </Button>
        </>
      }
    >
      {conflicts.length > 0 && (
        <Box sx={{ display: "flex", gap: 1, p: 1.25, mb: 2, borderRadius: 1.5, border: 1, borderColor: "warning.main", bgcolor: (t) => `${t.palette.warning.main}14` }}>
          <WarningAmberRoundedIcon sx={{ fontSize: 18, color: "warning.main" }} />
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>Overlaps {conflicts.length} other schedule{conflicts.length === 1 ? "" : "s"}</Typography>
            <Typography variant="body2" color="text.secondary">
              {conflicts.map((c) => `${c.name} (${c.priority})`).join(", ")}. The highest priority plays during the overlap.
            </Typography>
          </Box>
        </Box>
      )}

      <Section title="When">
        <Box sx={{ display: "grid", gap: 1.5 }}>
          <TextField select label="Status" value={schedule.status} onChange={(e) => changeStatus(e.target.value as ScheduleStatus)} disabled={update.isPending} fullWidth helperText="Only Active schedules are served to players">
            <MenuItem value="Active">Active</MenuItem>
            <MenuItem value="Draft">Draft</MenuItem>
            <MenuItem value="Paused">Paused</MenuItem>
          </TextField>
          <FieldGrid>
            <Field label="Daily window">
              {schedule.startTime} – {schedule.endTime}
            </Field>
            <Field label="Repeats">{schedule.repeat}</Field>
            <Field label="Runs from">{formatDate(schedule.startDate)}</Field>
            <Field label="Until">{formatDate(schedule.endDate)}</Field>
            <Field label="Priority">{schedule.priority}</Field>
            <Field label="Schedule ID" mono>
              {schedule.id}
            </Field>
          </FieldGrid>
        </Box>
      </Section>

      <Section title="Plays">
        {playlist ? (
          <Box
            component={RouterLink}
            to={`/playlists?select=${encodeURIComponent(playlist.id)}`}
            sx={{ display: "flex", alignItems: "center", gap: 1, p: 1, borderRadius: 1, border: 1, borderColor: "surface.border", textDecoration: "none", color: "inherit", "&:hover": { bgcolor: "surface.hover" } }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 600, fontSize: 13 }} noWrap>
                {playlist.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {playlist.items.length} items
              </Typography>
            </Box>
            <StatusChip label={playlist.status} />
          </Box>
        ) : (
          <Typography variant="body2" color="error.main">
            Playlist {schedule.playlistId} no longer exists.
          </Typography>
        )}
      </Section>

      <Section title={`On screens (${targets.length})`}>
        {targets.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No screens targeted.
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            {targets.map((d) => (
              <Chip key={d.id} component={RouterLink} to={`/devices?select=${encodeURIComponent(d.id)}`} clickable label={d.name} variant="outlined" color={d.status === "Offline" ? "error" : "default"} />
            ))}
          </Box>
        )}
      </Section>

      <OwnerSection kind="schedule" id={schedule.id} clientId={schedule.clientId} />
    </DetailPanel>
  );
}
