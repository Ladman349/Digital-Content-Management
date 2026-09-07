import { useMemo } from "react";
import { Box, MenuItem, TextField, Tooltip, Typography } from "@mui/material";
import type { Device } from "../../types/device";
import type { Playlist } from "../../types/playlist";
import type { Schedule } from "../../types/schedule";
import EmptyState from "../../components/ui/EmptyState";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import { isScheduleLiveNow } from "../../utils/schedule";
import { minutesOfDay } from "../../utils/format";

interface Props {
  schedules: Schedule[];
  devices: Device[];
  playlists: Playlist[];
  now: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  deviceFilter: string;
  onDeviceFilter: (v: string) => void;
}

const HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 24];
const MINUTES_IN_DAY = 1440;
const ROW_HEIGHT = 34;
const LABEL_WIDTH = 150;

const BAND_TONES = ["primary", "info", "success", "warning", "error"] as const;

/**
 * One row per screen showing today's active schedule windows as horizontal bands, so overlaps
 * (which the backend resolves by priority) are visible at a glance. Draft/Paused schedules are hidden.
 */
export default function DayTimeline({ schedules, devices, playlists, now, selectedId, onSelect, deviceFilter, onDeviceFilter }: Props) {
  const today = new Date(now);
  const nowPct = ((today.getHours() * 60 + today.getMinutes()) / MINUTES_IN_DAY) * 100;

  const playlistById = useMemo(() => new Map(playlists.map((p) => [p.id, p])), [playlists]);

  const visibleDevices = useMemo(() => {
    const list = deviceFilter === "All" ? devices : devices.filter((d) => d.id === deviceFilter);
    return list.filter((d) => deviceFilter !== "All" || schedules.some((s) => s.deviceIds.includes(d.id)));
  }, [devices, deviceFilter, schedules]);

  const colorFor = (id: string) => BAND_TONES[Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0)) % BAND_TONES.length];

  if (devices.length === 0) {
    return (
      <Box sx={{ border: 1, borderColor: "surface.border", borderRadius: 2, bgcolor: "background.paper" }}>
        <EmptyState icon={EventRoundedIcon} title="No devices" description="Register a screen to see its day plan." />
      </Box>
    );
  }

  return (
    <Box sx={{ border: 1, borderColor: "surface.border", borderRadius: 2, bgcolor: "background.paper", overflow: "hidden" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 1.75, py: 1.25, borderBottom: 1, borderColor: "surface.border", flexWrap: "wrap" }}>
        <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>Today by screen</Typography>
        <Typography variant="caption" color="text.secondary">
          Active schedules only · times in IST
        </Typography>
        <Box sx={{ flex: 1 }} />
        <TextField select size="small" label="Screen" value={deviceFilter} onChange={(e) => onDeviceFilter(e.target.value)} sx={{ width: 180 }}>
          <MenuItem value="All">All screens</MenuItem>
          {devices.map((d) => (
            <MenuItem key={d.id} value={d.id}>
              {d.name}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      <Box sx={{ overflowX: "auto" }}>
        <Box sx={{ minWidth: 720, position: "relative" }}>
          {/* Hour ruler */}
          <Box sx={{ display: "flex", pl: `${LABEL_WIDTH}px`, borderBottom: 1, borderColor: "surface.border", height: 26 }}>
            <Box sx={{ position: "relative", flex: 1 }}>
              {HOURS.map((h) => (
                <Typography
                  key={h}
                  variant="caption"
                  color="text.secondary"
                  sx={{ position: "absolute", left: `${(h / 24) * 100}%`, transform: h === 24 ? "translateX(-100%)" : "translateX(-50%)", top: 5, fontVariantNumeric: "tabular-nums" }}
                >
                  {String(h).padStart(2, "0")}:00
                </Typography>
              ))}
            </Box>
          </Box>

          {visibleDevices.map((device) => {
            const bands = schedules.filter((s) => s.status === "Active" && s.deviceIds.includes(device.id));
            return (
              <Box key={device.id} sx={{ display: "flex", borderBottom: 1, borderColor: "surface.border", "&:last-of-type": { borderBottom: 0 } }}>
                <Box sx={{ width: LABEL_WIDTH, flexShrink: 0, px: 1.25, py: 0.75, borderRight: 1, borderColor: "surface.border" }}>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 600 }} noWrap title={device.name}>
                    {device.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {device.location}
                  </Typography>
                </Box>

                <Box sx={{ position: "relative", flex: 1, minHeight: ROW_HEIGHT + 12, py: 0.75 }}>
                  {/* grid lines */}
                  {HOURS.slice(1, -1).map((h) => (
                    <Box key={h} sx={{ position: "absolute", left: `${(h / 24) * 100}%`, top: 0, bottom: 0, width: "1px", bgcolor: "surface.border" }} />
                  ))}
                  {/* now marker */}
                  <Tooltip title="Now">
                    <Box sx={{ position: "absolute", left: `${nowPct}%`, top: 0, bottom: 0, width: "2px", bgcolor: "error.main", zIndex: 2, opacity: 0.8 }} />
                  </Tooltip>

                  {bands.length === 0 ? (
                    <Typography variant="caption" color="text.disabled" sx={{ position: "absolute", left: 8, top: 10 }}>
                      No active schedule — plays its assigned playlist
                    </Typography>
                  ) : (
                    bands.map((s, i) => {
                      const start = minutesOfDay(s.startTime);
                      const end = minutesOfDay(s.endTime);
                      const left = (start / MINUTES_IN_DAY) * 100;
                      const width = Math.max(0.8, ((end - start) / MINUTES_IN_DAY) * 100);
                      const tone = colorFor(s.id);
                      const active = selectedId === s.id;
                      const live = isScheduleLiveNow(s, today);
                      return (
                        <Tooltip key={s.id} title={`${s.name} · ${s.startTime}–${s.endTime} · ${s.repeat} · ${s.priority} priority · ${playlistById.get(s.playlistId)?.name ?? "missing playlist"}`}>
                          <Box
                            onClick={() => onSelect(active ? null : s.id)}
                            sx={(t) => ({
                              position: "absolute",
                              left: `${left}%`,
                              width: `${width}%`,
                              top: 4 + (i % 2) * 3,
                              height: ROW_HEIGHT - 10,
                              borderRadius: 1,
                              px: 0.75,
                              display: "flex",
                              alignItems: "center",
                              cursor: "pointer",
                              overflow: "hidden",
                              bgcolor: `${t.palette[tone].main}${active ? "40" : "26"}`,
                              border: 1,
                              borderColor: active ? t.palette[tone].main : `${t.palette[tone].main}66`,
                              boxShadow: live ? `inset 0 0 0 1px ${t.palette[tone].main}` : "none",
                              zIndex: active ? 3 : 1,
                              "&:hover": { bgcolor: `${t.palette[tone].main}40` },
                            })}
                          >
                            <Typography sx={{ fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: `${tone}.main` }}>{s.name}</Typography>
                          </Box>
                        </Tooltip>
                      );
                    })
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
