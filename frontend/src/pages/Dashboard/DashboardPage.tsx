import { useMemo } from "react";
import { Box, Button, Chip, Paper, Tooltip, Typography } from "@mui/material";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import TvRoundedIcon from "@mui/icons-material/TvRounded";
import CloudOffRoundedIcon from "@mui/icons-material/CloudOffRounded";
import PermMediaRoundedIcon from "@mui/icons-material/PermMediaRounded";
import PlaylistPlayRoundedIcon from "@mui/icons-material/PlaylistPlayRounded";
import EventAvailableRoundedIcon from "@mui/icons-material/EventAvailableRounded";
import SystemUpdateAltRoundedIcon from "@mui/icons-material/SystemUpdateAltRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";

import KpiTile from "../../components/ui/KpiTile";
import StatusDot from "../../components/ui/StatusDot";
import { deviceTone } from "../../components/ui/tone";
import StatusChip from "../../components/ui/StatusChip";
import EmptyState from "../../components/ui/EmptyState";
import { useAppUpdates, useDevices, useMedia, usePlaylists, useSchedules } from "../../hooks/queries";
import { useNow } from "../../hooks/useNow";
import { usePlaybackMap } from "../../hooks/usePlayback";
import { findConflicts, isScheduleExpired, isScheduleLiveNow } from "../../utils/schedule";
import { formatBytes, formatDateTime, relativeTime } from "../../utils/format";

interface Attention {
  key: string;
  severity: "error" | "warning";
  text: string;
  to: string;
}

function Panel({ title, action, children, sx }: { title: string; action?: React.ReactNode; children: React.ReactNode; sx?: object }) {
  return (
    <Paper sx={{ border: 1, borderColor: "surface.border", borderRadius: 2, display: "flex", flexDirection: "column", minWidth: 0, ...sx }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1.75, py: 1.25, borderBottom: 1, borderColor: "surface.border" }}>
        <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{title}</Typography>
        {action}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0 }}>{children}</Box>
    </Paper>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const now = useNow(15_000);
  const { data: devices = [], isLoading: devicesLoading } = useDevices();
  const { data: media = [], isLoading: mediaLoading } = useMedia();
  const { data: playlists = [], isLoading: playlistsLoading } = usePlaylists();
  const { data: schedules = [], isLoading: schedulesLoading } = useSchedules();
  const { data: updates = [] } = useAppUpdates();
  const playback = usePlaybackMap(devices, playlists, schedules, now);

  const online = devices.filter((d) => d.status === "Online").length;
  const offline = devices.filter((d) => d.status === "Offline").length;
  const totalBytes = media.reduce((sum, m) => sum + (m.size || 0), 0);
  const published = playlists.filter((p) => p.status === "Published").length;
  const liveNow = schedules.filter((s) => isScheduleLiveNow(s, new Date(now)));
  const activeUpdate = updates.find((u) => u.is_active);

  const attention = useMemo<Attention[]>(() => {
    const items: Attention[] = [];
    devices
      .filter((d) => d.status === "Offline")
      .forEach((d) => items.push({ key: `off-${d.id}`, severity: "error", text: `${d.name} is offline (last seen ${relativeTime(d.heartbeatAt ?? d.lastSeenMs, now)})`, to: `/devices?select=${encodeURIComponent(d.id)}` }));
    devices.forEach((d) => {
      const p = playback.get(d.id);
      if (p?.mismatch) items.push({ key: `mis-${d.id}`, severity: "warning", text: `${d.name} reports “${p.reported?.name ?? "nothing"}” but should play “${p.effective?.name}”`, to: `/devices?select=${encodeURIComponent(d.id)}` });
      if (d.storageUsed && d.storageTotal && d.storageUsed / d.storageTotal > 0.9) items.push({ key: `sto-${d.id}`, severity: "warning", text: `${d.name} storage is ${Math.round((d.storageUsed / d.storageTotal) * 100)}% full`, to: `/devices?select=${encodeURIComponent(d.id)}` });
    });
    const active = schedules.filter((s) => s.status === "Active");
    active.forEach((s) => {
      if (isScheduleExpired(s, new Date(now))) items.push({ key: `exp-${s.id}`, severity: "warning", text: `Schedule “${s.name}” is Active but ended on ${s.endDate}`, to: `/schedule?select=${encodeURIComponent(s.id)}` });
      else if (findConflicts(active, s).length) items.push({ key: `con-${s.id}`, severity: "warning", text: `Schedule “${s.name}” overlaps another active schedule on the same screen`, to: `/schedule?select=${encodeURIComponent(s.id)}` });
    });
    devices
      .filter((d) => d.status !== "Offline" && !playback.get(d.id)?.effective)
      .forEach((d) => items.push({ key: `idle-${d.id}`, severity: "warning", text: `${d.name} has nothing to play`, to: `/devices?select=${encodeURIComponent(d.id)}` }));
    return items.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1));
  }, [devices, schedules, playback, now]);

  const activity = useMemo(() => {
    const events: { key: string; ts: number; text: string; to: string }[] = [];
    media.forEach((m) => events.push({ key: `m-${m.id}`, ts: m.uploadedAt, text: `Media “${m.name}” uploaded`, to: `/media?select=${encodeURIComponent(m.id)}` }));
    playlists.forEach((p) => events.push({ key: `p-${p.id}`, ts: p.updatedAt, text: `Playlist “${p.name}” updated`, to: `/playlists?select=${encodeURIComponent(p.id)}` }));
    schedules.forEach((s) => events.push({ key: `s-${s.id}`, ts: s.updatedAt ?? s.createdAt ?? 0, text: `Schedule “${s.name}” ${s.updatedAt && s.updatedAt !== s.createdAt ? "updated" : "created"}`, to: `/schedule?select=${encodeURIComponent(s.id)}` }));
    return events.filter((e) => e.ts > 0).sort((a, b) => b.ts - a.ts).slice(0, 8);
  }, [media, playlists, schedules]);

  const deviceRows = useMemo(() => [...devices].sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === "Offline" ? -1 : b.status === "Offline" ? 1 : a.status === "Idle" ? -1 : 1)).slice(0, 10), [devices]);

  const listItemSx = {
    display: "flex",
    alignItems: "center",
    gap: 1.25,
    px: 1.75,
    py: 1,
    borderBottom: 1,
    borderColor: "surface.border",
    textDecoration: "none",
    color: "inherit",
    "&:last-child": { borderBottom: 0 },
    "&:hover": { bgcolor: "surface.hover" },
  } as const;

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Typography variant="h1">Overview</Typography>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" startIcon={<CloudUploadRoundedIcon />} onClick={() => navigate("/media?upload=1")}>
          Upload media
        </Button>
        <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={() => navigate("/playlists?new=1")}>
          New playlist
        </Button>
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => navigate("/schedule?new=1")}>
          New schedule
        </Button>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(3, 1fr)", xl: "repeat(6, 1fr)" }, gap: 1.5 }}>
        <KpiTile label="Devices online" value={`${online} / ${devices.length}`} tone="success" icon={<TvRoundedIcon fontSize="small" />} loading={devicesLoading} onClick={() => navigate("/devices?status=Online")} />
        <KpiTile label="Offline" value={offline} tone={offline ? "error" : "neutral"} icon={<CloudOffRoundedIcon fontSize="small" />} loading={devicesLoading} onClick={() => navigate("/devices?status=Offline")} hint={offline ? "Needs attention" : "All screens reporting"} />
        <KpiTile label="Media files" value={media.length} tone="info" icon={<PermMediaRoundedIcon fontSize="small" />} loading={mediaLoading} onClick={() => navigate("/media")} hint={formatBytes(totalBytes)} />
        <KpiTile label="Playlists" value={playlists.length} tone="primary" icon={<PlaylistPlayRoundedIcon fontSize="small" />} loading={playlistsLoading} onClick={() => navigate("/playlists")} hint={`${published} published`} />
        <KpiTile label="Schedules live now" value={liveNow.length} tone={liveNow.length ? "success" : "neutral"} icon={<EventAvailableRoundedIcon fontSize="small" />} loading={schedulesLoading} onClick={() => navigate("/schedule?status=Live")} hint={`${schedules.filter((s) => s.status === "Active").length} active in total`} />
        <KpiTile label="Player release" value={activeUpdate ? activeUpdate.version_name : "—"} tone="neutral" icon={<SystemUpdateAltRoundedIcon fontSize="small" />} onClick={() => navigate("/updates")} hint={activeUpdate ? `build ${activeUpdate.version_code} · ${activeUpdate.download_count} downloads` : "No active release"} />
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 3fr) minmax(0, 2fr)" }, gap: 2, alignItems: "start" }}>
        <Panel
          title="Screens"
          action={
            <Button size="small" component={RouterLink} to="/devices">
              View all
            </Button>
          }
        >
          {devicesLoading ? null : devices.length === 0 ? (
            <EmptyState compact icon={TvRoundedIcon} title="No devices registered" description="Install the player app on a TV and it will appear here." />
          ) : (
            <Box>
              {deviceRows.map((d) => {
                const p = playback.get(d.id);
                return (
                  <Box key={d.id} component={RouterLink} to={`/devices?select=${encodeURIComponent(d.id)}`} sx={listItemSx}>
                    <StatusDot tone={deviceTone(d.status)} pulse={d.status === "Online"} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: 13 }} noWrap>
                        {d.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {d.location} · {p?.effective ? p.effective.name : "nothing assigned"}
                        {p?.liveSchedule ? " (scheduled)" : ""}
                      </Typography>
                    </Box>
                    {p?.mismatch && <Chip label="out of sync" color="warning" variant="outlined" sx={{ height: 18, fontSize: 10.5 }} />}
                    <Tooltip title={formatDateTime(d.heartbeatAt ?? d.lastSeenMs)}>
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap", minWidth: 56, textAlign: "right" }}>
                        {relativeTime(d.heartbeatAt ?? d.lastSeenMs, now)}
                      </Typography>
                    </Tooltip>
                  </Box>
                );
              })}
            </Box>
          )}
        </Panel>

        <Box sx={{ display: "grid", gap: 2 }}>
          <Panel title={`Needs attention${attention.length ? ` (${attention.length})` : ""}`}>
            {attention.length === 0 ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.75, py: 2, color: "success.main" }}>
                <CheckCircleOutlineRoundedIcon fontSize="small" />
                <Typography variant="body2">Everything looks healthy.</Typography>
              </Box>
            ) : (
              <Box sx={{ maxHeight: 280, overflowY: "auto" }}>
                {attention.map((a) => (
                  <Box key={a.key} component={RouterLink} to={a.to} sx={listItemSx}>
                    <WarningAmberRoundedIcon sx={{ fontSize: 18, color: `${a.severity}.main`, flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ minWidth: 0 }}>
                      {a.text}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Panel>

          <Panel
            title="Live now"
            action={
              <Button size="small" component={RouterLink} to="/schedule">
                Schedule
              </Button>
            }
          >
            {liveNow.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ px: 1.75, py: 2 }}>
                No schedule is running right now. Screens fall back to their directly assigned playlist.
              </Typography>
            ) : (
              <Box>
                {liveNow.map((s) => (
                  <Box key={s.id} component={RouterLink} to={`/schedule?select=${encodeURIComponent(s.id)}`} sx={listItemSx}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: 13 }} noWrap>
                        {s.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {playlists.find((p) => p.id === s.playlistId)?.name ?? s.playlistId} · {s.startTime}–{s.endTime} · {s.deviceIds.length} screen{s.deviceIds.length === 1 ? "" : "s"}
                      </Typography>
                    </Box>
                    <StatusChip label={s.priority} dot={false} />
                  </Box>
                ))}
              </Box>
            )}
          </Panel>
        </Box>
      </Box>

      <Panel title="Recent changes">
        {activity.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 1.75, py: 2 }}>
            Nothing yet.
          </Typography>
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
            {activity.map((e) => (
              <Box key={e.key} component={RouterLink} to={e.to} sx={{ ...listItemSx, "&:last-child": {} }}>
                <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                  {e.text}
                </Typography>
                <Tooltip title={formatDateTime(e.ts)}>
                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                    {relativeTime(e.ts, now)}
                  </Typography>
                </Tooltip>
              </Box>
            ))}
          </Box>
        )}
      </Panel>
    </Box>
  );
}
