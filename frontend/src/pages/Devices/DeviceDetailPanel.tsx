import { Box, Button, Chip, IconButton, LinearProgress, MenuItem, TextField, Tooltip, Typography } from "@mui/material";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { useSnackbar } from "notistack";
import { Link as RouterLink } from "react-router-dom";
import type { Device } from "../../types/device";
import { ORIENTATION_LABELS } from "../../types/device";
import type { Playlist } from "../../types/playlist";
import type { Schedule } from "../../types/schedule";
import type { DevicePlayback } from "../../hooks/usePlayback";
import { useAssignPlaylistToDevices } from "../../hooks/queries";
import DetailPanel from "../../components/ui/DetailPanel";
import Field, { FieldGrid, Section } from "../../components/ui/Field";
import StatusChip from "../../components/ui/StatusChip";
import OwnerSection from "../../components/ui/OwnerSection";
import { formatDateTime, formatMegabytes, formatUptime, relativeTime } from "../../utils/format";

interface Props {
  device: Device | null;
  playback?: DevicePlayback;
  playlists: Playlist[];
  schedules: Schedule[];
  now: number;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  position?: string;
  onEdit: (d: Device) => void;
  onDelete: (d: Device) => void;
}

export default function DeviceDetailPanel({ device, playback, playlists, schedules, now, onClose, onPrev, onNext, position, onEdit, onDelete }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const assign = useAssignPlaylistToDevices();

  if (!device) return null;

  const storagePct = device.storageUsed && device.storageTotal ? Math.min(100, (device.storageUsed / device.storageTotal) * 100) : null;
  const targeting = schedules.filter((s) => s.deviceIds.includes(device.id));
  const publishable = playlists.filter((p) => p.status === "Published" || p.id === playback?.assigned?.id);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(device.id);
      enqueueSnackbar("Device ID copied", { variant: "info" });
    } catch {
      enqueueSnackbar("Clipboard unavailable", { variant: "warning" });
    }
  };

  const handleAssign = (playlistId: string) => {
    assign.mutate(
      { playlistId: playlistId || null, deviceIds: [device.id] },
      {
        onSuccess: () => enqueueSnackbar(playlistId ? "Playlist assigned" : "Assignment cleared", { variant: "success" }),
        onError: (e) => enqueueSnackbar((e as Error).message, { variant: "error" }),
      },
    );
  };

  return (
    <DetailPanel
      open
      onClose={onClose}
      onPrev={onPrev}
      onNext={onNext}
      position={position}
      title={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          {device.name}
          <StatusChip label={device.status} pulse={device.status === "Online"} />
        </Box>
      }
      subtitle={
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
          <Box component="span" sx={{ fontFamily: "ui-monospace, monospace" }}>
            {device.id}
          </Box>
          <Tooltip title="Copy device ID">
            <IconButton onClick={copyId} sx={{ p: 0.25 }} aria-label="Copy device ID">
              <ContentCopyRoundedIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
          <span>·</span>
          <span>{device.location}</span>
        </Box>
      }
      actions={
        <>
          <Button variant="outlined" color="error" startIcon={<DeleteOutlineRoundedIcon />} onClick={() => onDelete(device)}>
            Delete
          </Button>
          <Button variant="contained" startIcon={<EditOutlinedIcon />} onClick={() => onEdit(device)}>
            Edit
          </Button>
        </>
      }
    >
      <Section title="Playback">
        <Box sx={{ display: "grid", gap: 1.25 }}>
          <Field label="Should be playing">
            {playback?.effective ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                <RouterLink to={`/playlists?select=${encodeURIComponent(playback.effective.id)}`} style={{ color: "inherit", fontWeight: 600 }}>
                  {playback.effective.name}
                </RouterLink>
                {playback.liveSchedule ? <Chip label={`via schedule “${playback.liveSchedule.name}”`} variant="outlined" /> : <Chip label="direct assignment" variant="outlined" />}
              </Box>
            ) : (
              <Typography component="span" color="text.secondary">
                Nothing assigned
              </Typography>
            )}
          </Field>
          <Field label="Device reports">
            {playback?.reported ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                {playback.reported.name}
                {playback.mismatch && <Chip label="differs from expected" color="warning" variant="outlined" />}
              </Box>
            ) : device.currentPlaylistId ? (
              <Typography component="span" color="text.secondary">
                Unknown playlist {device.currentPlaylistId}
              </Typography>
            ) : (
              <Typography component="span" color="text.secondary">
                No playback reported
              </Typography>
            )}
          </Field>
          <TextField
            select
            label="Direct assignment"
            value={playback?.assigned?.id ?? ""}
            onChange={(e) => handleAssign(e.target.value)}
            disabled={assign.isPending}
            helperText="Used whenever no schedule is live for this screen."
            fullWidth
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {publishable.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
                {p.status !== "Published" ? ` (${p.status})` : ""}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </Section>

      <Section title="Health">
        <FieldGrid>
          <Field label="Last heartbeat">
            <Tooltip title={formatDateTime(device.heartbeatAt ?? device.lastSeenMs)}>
              <span>{relativeTime(device.heartbeatAt ?? device.lastSeenMs, now)}</span>
            </Tooltip>
          </Field>
          <Field label="Uptime">{formatUptime(device.uptimeSeconds)}</Field>
          <Field label="IP address" mono>
            {device.ipAddress || "—"}
          </Field>
          <Field label="App version" mono>
            {device.appVersion || "—"}
          </Field>
          <Field label="Firmware">{device.firmwareVersion ? `Android ${device.firmwareVersion}` : "—"}</Field>
          <Field label="Display">
            {device.resolution}
            {device.orientation && device.orientation !== "LANDSCAPE" ? ` · ${ORIENTATION_LABELS[device.orientation]}` : ""}
          </Field>
        </FieldGrid>
        <Box sx={{ mt: 1.5 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Storage
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {storagePct !== null ? `${formatMegabytes(device.storageUsed)} of ${formatMegabytes(device.storageTotal)} used` : "Not reported"}
            </Typography>
          </Box>
          <LinearProgress variant="determinate" value={storagePct ?? 0} color={storagePct !== null && storagePct > 90 ? "error" : "primary"} />
        </Box>
      </Section>

      <Section
        title={`Schedules targeting this screen (${targeting.length})`}
        action={
          <Button size="small" component={RouterLink} to={`/schedule?device=${encodeURIComponent(device.id)}`} endIcon={<OpenInNewRoundedIcon sx={{ fontSize: 14 }} />}>
            Open
          </Button>
        }
      >
        {targeting.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            None. Create a schedule to run a playlist here at specific times.
          </Typography>
        ) : (
          <Box sx={{ display: "grid", gap: 0.5 }}>
            {targeting.map((s) => (
              <Box
                key={s.id}
                component={RouterLink}
                to={`/schedule?select=${encodeURIComponent(s.id)}`}
                sx={{ display: "flex", alignItems: "center", gap: 1, p: 1, borderRadius: 1, border: 1, borderColor: "surface.border", textDecoration: "none", color: "inherit", "&:hover": { bgcolor: "surface.hover" } }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: 13 }} noWrap>
                    {s.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {s.startTime}–{s.endTime} · {s.repeat} · {s.startDate === s.endDate ? s.startDate : `${s.startDate} → ${s.endDate}`}
                  </Typography>
                </Box>
                <StatusChip label={s.status} />
              </Box>
            ))}
          </Box>
        )}
      </Section>

      <OwnerSection kind="screen" id={device.id} clientId={device.clientId} name={device.name} />
    </DetailPanel>
  );
}
