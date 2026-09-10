import { useMemo } from "react";
import { Box, Button, Typography } from "@mui/material";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import TvRoundedIcon from "@mui/icons-material/TvRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";

import StatusChip from "../../components/ui/StatusChip";
import RowLead from "../../components/ui/RowLead";
import EmptyState from "../../components/ui/EmptyState";
import Field, { Section } from "../../components/ui/Field";
import { deviceTone } from "../../components/ui/tone";
import { MONO } from "../../app/theme";
import { useAppUpdates, useDevices, useMedia, usePlaylists, useSchedules } from "../../hooks/queries";
import { useNow } from "../../hooks/useNow";
import { usePlaybackMap } from "../../hooks/usePlayback";
import { findConflicts, isScheduleExpired, isScheduleLiveNow } from "../../utils/schedule";
import { formatBytes, formatDuration, relativeTime } from "../../utils/format";

interface Attention {
  key: string;
  severity: "error" | "warning";
  /** One word for what kind of problem this is — the column that lets you skim the band. */
  tag: string;
  text: string;
  when: string;
  to: string;
}

/** A row on the board: what one screen is showing right now. */
function BoardRow({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "minmax(0, 1fr) auto", md: "minmax(0, 1.6fr) minmax(0, 1.2fr) 90px 118px 120px" },
        alignItems: "center",
        gap: { xs: 1, md: 2 },
        bgcolor: "board.cell",
        px: { xs: 1.5, md: 1.75 },
        py: 1.5,
        textDecoration: "none",
        color: "inherit",
        "&:hover": { bgcolor: "surface.hover" },
      }}
    >
      {children}
    </Box>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const now = useNow(15_000);
  const { data: devices = [], isLoading: devicesLoading } = useDevices();
  const { data: media = [] } = useMedia();
  const { data: playlists = [] } = usePlaylists();
  const { data: schedules = [] } = useSchedules();
  const { data: updates = [] } = useAppUpdates();
  const playback = usePlaybackMap(devices, playlists, schedules, now);

  const online = devices.filter((d) => d.status === "Online").length;
  const totalBytes = media.reduce((sum, m) => sum + (m.size || 0), 0);
  const published = playlists.filter((p) => p.status === "Published").length;
  const liveNow = schedules.filter((s) => isScheduleLiveNow(s, new Date(now)));
  const activeUpdate = updates.find((u) => u.is_active);
  const longest = playlists.reduce((max, p) => Math.max(max, p.totalDuration || 0), 0);

  const attention = useMemo<Attention[]>(() => {
    const items: Attention[] = [];
    devices
      .filter((d) => d.status === "Offline")
      .forEach((d) =>
        items.push({
          key: `off-${d.id}`,
          severity: "error",
          tag: "Offline",
          text: `${d.name} stopped reporting`,
          when: relativeTime(d.heartbeatAt ?? d.lastSeenMs, now),
          to: `/devices?select=${encodeURIComponent(d.id)}`,
        }),
      );
    devices.forEach((d) => {
      const p = playback.get(d.id);
      if (p?.mismatch)
        items.push({
          key: `mis-${d.id}`,
          severity: "warning",
          tag: "Out of sync",
          text: `${d.name} reports “${p.reported?.name ?? "nothing"}” but should play “${p.effective?.name}”`,
          when: relativeTime(d.heartbeatAt ?? d.lastSeenMs, now),
          to: `/devices?select=${encodeURIComponent(d.id)}`,
        });
      if (d.storageUsed && d.storageTotal && d.storageUsed / d.storageTotal > 0.9)
        items.push({
          key: `sto-${d.id}`,
          severity: "warning",
          tag: "Disk full",
          text: `${d.name} storage is ${Math.round((d.storageUsed / d.storageTotal) * 100)}% full`,
          when: "now",
          to: `/devices?select=${encodeURIComponent(d.id)}`,
        });
    });
    const active = schedules.filter((s) => s.status === "Active");
    active.forEach((s) => {
      if (isScheduleExpired(s, new Date(now)))
        items.push({
          key: `exp-${s.id}`,
          severity: "warning",
          tag: "Expired",
          text: `Schedule “${s.name}” is still Active but ended ${s.endDate}`,
          when: relativeTime(s.updatedAt ?? s.createdAt ?? 0, now),
          to: `/schedule?select=${encodeURIComponent(s.id)}`,
        });
      else if (findConflicts(active, s).length)
        items.push({
          key: `con-${s.id}`,
          severity: "warning",
          tag: "Overlap",
          text: `Schedule “${s.name}” overlaps another active schedule on the same screen`,
          when: "today",
          to: `/schedule?select=${encodeURIComponent(s.id)}`,
        });
    });
    devices
      .filter((d) => d.status !== "Offline" && !playback.get(d.id)?.effective)
      .forEach((d) =>
        items.push({
          key: `idle-${d.id}`,
          severity: "warning",
          tag: "Dark",
          text: `${d.name} has nothing to play`,
          when: "now",
          to: `/devices?select=${encodeURIComponent(d.id)}`,
        }),
      );
    return items.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1));
  }, [devices, schedules, playback, now]);

  const activity = useMemo(() => {
    const events: { key: string; ts: number; text: string; to: string }[] = [];
    media.forEach((m) => events.push({ key: `m-${m.id}`, ts: m.uploadedAt, text: m.name, to: `/media?select=${encodeURIComponent(m.id)}` }));
    playlists.forEach((p) => events.push({ key: `p-${p.id}`, ts: p.updatedAt, text: `Playlist ${p.name}`, to: `/playlists?select=${encodeURIComponent(p.id)}` }));
    schedules.forEach((s) => events.push({ key: `s-${s.id}`, ts: s.updatedAt ?? s.createdAt ?? 0, text: `Schedule ${s.name}`, to: `/schedule?select=${encodeURIComponent(s.id)}` }));
    return events
      .filter((e) => e.ts > 0)
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 6);
  }, [media, playlists, schedules]);

  const deviceRows = useMemo(
    () =>
      [...devices]
        .sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === "Offline" ? -1 : b.status === "Offline" ? 1 : a.status === "Idle" ? -1 : 1))
        .slice(0, 10),
    [devices],
  );

  const errors = attention.filter((a) => a.severity === "error").length;

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "2px" }}>
      {/* Actions */}
      <Box
        sx={{
          order: { xs: 2, md: 1 },
          display: "grid",
          gridTemplateColumns: { xs: "repeat(3, 1fr)", md: "auto auto auto" },
          justifyContent: { xs: "stretch", md: "flex-end" },
          gap: 1,
          pb: 1.5,
          // At phone width the icons cost more room than they earn.
          '& .MuiButton-startIcon': { display: { xs: 'none', sm: 'inherit' } },
          '& .MuiButton-root': { px: { xs: 0.5, sm: 1.75 }, letterSpacing: { xs: '0.06em', sm: '0.14em' } },
        }}
      >
        <Button variant="outlined" startIcon={<CloudUploadRoundedIcon />} onClick={() => navigate("/media?upload=1")}>
          <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>Upload media</Box>
          <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>Upload</Box>
        </Button>
        <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={() => navigate("/playlists?new=1")}>
          <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>New playlist</Box>
          <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>Playlist</Box>
        </Button>
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => navigate("/schedule?new=1")}>
          <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>New schedule</Box>
          <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>Schedule</Box>
        </Button>
      </Box>

      {/* What is wrong, in sentences, before any counts. */}
      <Box sx={{ order: { xs: 1, md: 2 }, pb: 1.5, mb: 0.5, borderBottom: 1, borderColor: "surface.border" }}>
        <Typography variant="subtitle2" sx={{ color: "text.secondary", mb: 1.25 }}>
          {attention.length ? `Needs attention · ${attention.length}` : "All clear"}
        </Typography>

        {attention.length === 0 ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, color: "success.main", py: 0.5 }}>
            <CheckCircleOutlineRoundedIcon sx={{ fontSize: 18 }} />
            <Typography sx={{ fontSize: 13.5 }}>
              {devices.length === 0
                ? "No screens registered yet."
                : `Every screen is reporting${liveNow.length ? ` and ${liveNow.length} schedule${liveNow.length === 1 ? " is" : "s are"} running.` : " and playing its assigned playlist."}`}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: "grid", gap: 0.85, maxHeight: 260, overflowY: "auto" }}>
            {attention.map((a) => (
              <Box
                key={a.key}
                component={RouterLink}
                to={a.to}
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "10px 1fr", md: "10px 92px 1fr auto" },
                  gap: { xs: 1.25, md: 1.5 },
                  alignItems: "baseline",
                  textDecoration: "none",
                  color: "inherit",
                  "&:hover span.sig-text": { textDecoration: "underline" },
                }}
              >
                <Box
                  component="span"
                  sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: `${a.severity}.main`, alignSelf: "center" }}
                />
                <Typography
                  component="span"
                  sx={{
                    display: { xs: "none", md: "block" },
                    fontFamily: MONO,
                    fontSize: 10,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: `${a.severity}.main`,
                  }}
                >
                  {a.tag}
                </Typography>
                <Typography component="span" className="sig-text" sx={{ fontSize: 13, minWidth: 0 }}>
                  {a.text}
                </Typography>
                <Typography component="span" sx={{ display: { xs: "none", md: "block" }, fontFamily: MONO, fontSize: 10.5, color: "text.secondary" }}>
                  {a.when}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* The board */}
      <Box
        sx={{
          order: 3,
          display: { xs: "none", md: "grid" },
          gridTemplateColumns: "1.6fr 1.2fr 90px 118px 120px",
          gap: 2,
          px: 1.75,
          pt: 0.5,
          pb: 1,
        }}
      >
        {["Screen", "Showing", "Item", "Last seen", "Status"].map((h) => (
          <Typography key={h} variant="subtitle2" sx={{ color: "text.secondary" }}>
            {h}
          </Typography>
        ))}
      </Box>

      {devices.length === 0 && !devicesLoading ? (
        <EmptyState
          compact
          icon={TvRoundedIcon}
          title="No screens registered"
          description="Install the player app on a TV. It registers itself and appears here within a minute."
        />
      ) : (
        <Box sx={{ order: 4, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "2px" }}>
          {deviceRows.map((d) => {
            const p = playback.get(d.id);
            const idx = p?.effective ? p.effective.items.findIndex((i) => i.mediaId === d.currentMediaId) : -1;
            return (
              <Box key={d.id} component={RouterLink} to={`/devices?select=${encodeURIComponent(d.id)}`} sx={{ textDecoration: "none", color: "inherit" }}>
                <BoardRow>
                  <RowLead name={d.name} sub={`${d.id}${d.location && d.location !== "Unassigned" ? ` · ${d.location}` : ""}`} title={d.name} />
                  <Typography
                    sx={{
                      display: { xs: "none", md: "block" },
                      fontSize: 16,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      color: p?.effective ? "primary.main" : "text.disabled",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p?.effective ? p.effective.name : "— nothing —"}
                  </Typography>
                  <Typography sx={{ display: { xs: "none", md: "block" }, fontFamily: MONO, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>
                    {idx >= 0 ? (
                      <>
                        {idx + 1}
                        <Box component="span" sx={{ color: "text.secondary" }}>/{p?.effective?.items.length}</Box>
                      </>
                    ) : (
                      "—"
                    )}
                  </Typography>
                  <Typography sx={{ display: { xs: "none", md: "block" }, fontFamily: MONO, fontSize: 11.5, color: "text.secondary" }}>
                    {relativeTime(d.heartbeatAt ?? d.lastSeenMs, now)}
                  </Typography>
                  <StatusChip label={d.status} tone={deviceTone(d.status)} pulse={d.status === "Online"} />
                </BoardRow>
              </Box>
            );
          })}
        </Box>
      )}

      {/* The bench: totals and context, quietly */}
      <Box
        sx={(t) => ({
          order: 5,
          mt: "2px",
          bgcolor: "board.bench",
          borderTop: `2px solid ${t.palette.board.amber}`,
          px: { xs: 2, md: 2.5 },
          py: 2.25,
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(auto-fit, minmax(240px, 1fr))" },
          gap: { xs: 2, md: 3.5 },
          alignItems: "start",
        })}
      >
        <Section
          title="Next change"
          action={
            <Button size="small" component={RouterLink} to="/schedule">
              Schedule
            </Button>
          }
        >
          <Field label="Schedules live now">{liveNow.length ? `${liveNow.length} running` : "none queued"}</Field>
          <Field label="Screens reporting">
            <Box component="span" sx={{ color: online ? "success.main" : "error.main" }}>
              {online} of {devices.length}
            </Box>
          </Field>
          <Field label="Fallback">direct assignment</Field>
          <Typography sx={{ mt: 1.5, fontSize: 12, lineHeight: 1.55, color: "text.secondary" }}>
            {liveNow.length
              ? `${liveNow[0].name} is running until ${liveNow[0].endTime}.`
              : "No schedule is running. Screens fall back to whatever playlist is assigned to them directly."}
          </Typography>
        </Section>

        <Section
          title="Library"
          action={
            <Button size="small" component={RouterLink} to="/media">
              Media
            </Button>
          }
        >
          <Field label="Media files">{media.length}</Field>
          <Field label="Total size">{formatBytes(totalBytes)}</Field>
          <Field label="Playlists">{`${published} published`}</Field>
          <Field label="Longest run">{longest ? formatDuration(longest) : "—"}</Field>
          <Field label="Player release">{activeUpdate ? activeUpdate.version_name : "none active"}</Field>
        </Section>

        <Section title={`Recent changes${errors ? "" : ""}`}>
          {activity.length === 0 ? (
            <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>Nothing yet.</Typography>
          ) : (
            activity.map((e) => (
              <Box key={e.key} component={RouterLink} to={e.to} sx={{ textDecoration: "none", color: "inherit", display: "block" }}>
                <Field label={e.text}>{relativeTime(e.ts, now)}</Field>
              </Box>
            ))
          )}
        </Section>
      </Box>
    </Box>
  );
}
