import { Box, Dialog, InputBase, List, ListItemButton, ListItemIcon, ListItemText, ListSubheader, Typography } from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import TvRoundedIcon from "@mui/icons-material/TvRounded";
import PermMediaRoundedIcon from "@mui/icons-material/PermMediaRounded";
import PlaylistPlayRoundedIcon from "@mui/icons-material/PlaylistPlayRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { navigationFor } from "../../constants/navigation";
import { useAuth } from "../../auth/AuthProvider";
import { useDevices, useMedia, usePlaylists, useSchedules } from "../../hooks/queries";
import StatusDot from "../ui/StatusDot";
import { deviceTone } from "../ui/tone";

interface Props {
  onClose: () => void;
}

interface Result {
  id: string;
  group: string;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  to: string;
}

const MAX_PER_GROUP = 6;

function matches(q: string, ...fields: (string | null | undefined)[]) {
  return fields.some((f) => f && f.toLowerCase().includes(q));
}

/**
 * Global search (Ctrl/⌘+K). Searches the cached lists and jumps to the record with its inspector open.
 * The parent mounts this only while it is open, so state starts fresh on every invocation.
 */
export default function CommandPalette({ onClose }: Props) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const { data: devices = [] } = useDevices();
  const { data: media = [] } = useMedia();
  const { data: playlists = [] } = usePlaylists();
  const { data: schedules = [] } = useSchedules();

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    const out: Result[] = [];
    const navigationItems = navigationFor(isAdmin);
    if (!q) {
      navigationItems.forEach((n) => out.push({ id: `nav-${n.path}`, group: "Go to", title: n.title, icon: <n.icon fontSize="small" />, to: n.path }));
      return out;
    }
    navigationItems
      .filter((n) => n.title.toLowerCase().includes(q))
      .forEach((n) => out.push({ id: `nav-${n.path}`, group: "Go to", title: n.title, icon: <n.icon fontSize="small" />, to: n.path }));
    devices
      .filter((d) => matches(q, d.name, d.id, d.location, d.ipAddress))
      .slice(0, MAX_PER_GROUP)
      .forEach((d) =>
        out.push({
          id: `dev-${d.id}`,
          group: "Devices",
          title: d.name,
          subtitle: `${d.id} · ${d.location}`,
          icon: (
            <Box sx={{ position: "relative", display: "flex" }}>
              <TvRoundedIcon fontSize="small" />
              <Box sx={{ position: "absolute", right: -3, bottom: -2 }}>
                <StatusDot tone={deviceTone(d.status)} size={7} />
              </Box>
            </Box>
          ),
          to: `/devices?select=${encodeURIComponent(d.id)}`,
        }),
      );
    media
      .filter((m) => matches(q, m.name, m.id, m.category))
      .slice(0, MAX_PER_GROUP)
      .forEach((m) => out.push({ id: `med-${m.id}`, group: "Media", title: m.name, subtitle: `${m.type} · ${m.category}`, icon: <PermMediaRoundedIcon fontSize="small" />, to: `/media?select=${encodeURIComponent(m.id)}` }));
    playlists
      .filter((p) => matches(q, p.name, p.id, p.description))
      .slice(0, MAX_PER_GROUP)
      .forEach((p) => out.push({ id: `pl-${p.id}`, group: "Playlists", title: p.name, subtitle: `${p.status} · ${p.items.length} items`, icon: <PlaylistPlayRoundedIcon fontSize="small" />, to: `/playlists?select=${encodeURIComponent(p.id)}` }));
    schedules
      .filter((s) => matches(q, s.name, s.id))
      .slice(0, MAX_PER_GROUP)
      .forEach((s) => out.push({ id: `sch-${s.id}`, group: "Schedules", title: s.name, subtitle: `${s.status} · ${s.startDate} → ${s.endDate}`, icon: <EventRoundedIcon fontSize="small" />, to: `/schedule?select=${encodeURIComponent(s.id)}` }));
    return out;
  }, [query, devices, media, playlists, schedules, isAdmin]);

  // Clamp during render instead of resetting from an effect: the result list shrinks as you type.
  const activeIndex = results.length === 0 ? -1 : Math.min(cursor, results.length - 1);

  const go = (r: Result) => {
    onClose();
    navigate(r.to);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor(Math.min(results.length - 1, activeIndex + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor(Math.max(0, activeIndex - 1));
    } else if (e.key === "Enter" && results[activeIndex]) {
      e.preventDefault();
      go(results[activeIndex]);
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<string, Result[]>();
    results.forEach((r) => map.set(r.group, [...(map.get(r.group) ?? []), r]));
    return Array.from(map.entries());
  }, [results]);

  let flatIndex = -1;

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" slotProps={{ paper: { sx: { position: "absolute", top: "10vh", m: 0, width: "min(640px, calc(100vw - 32px))" } } }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, height: 52, borderBottom: 1, borderColor: "surface.border" }}>
        <SearchRoundedIcon sx={{ color: "text.disabled" }} />
        <InputBase
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search devices, media, playlists, schedules…"
          fullWidth
          sx={{ fontSize: 15 }}
          slotProps={{ input: { "aria-label": "Search" } }}
        />
        <Box component="kbd" sx={{ fontSize: 11, px: 0.6, borderRadius: 0.75, border: 1, borderColor: "surface.borderStrong", color: "text.disabled", fontFamily: "inherit" }}>
          esc
        </Box>
      </Box>
      <Box sx={{ maxHeight: "55vh", overflowY: "auto", py: 0.5 }}>
        {results.length === 0 && (
          <Typography sx={{ p: 3, textAlign: "center" }} color="text.secondary">
            No matches for “{query}”
          </Typography>
        )}
        {grouped.map(([group, items]) => (
          <List
            key={group}
            dense
            disablePadding
            subheader={
              <ListSubheader disableSticky sx={{ lineHeight: "28px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", bgcolor: "transparent" }}>
                {group}
              </ListSubheader>
            }
          >
            {items.map((r) => {
              flatIndex += 1;
              const active = flatIndex === activeIndex;
              const idx = flatIndex;
              return (
                <ListItemButton key={r.id} selected={active} onMouseEnter={() => setCursor(idx)} onClick={() => go(r)} sx={{ mx: 1, borderRadius: 1.5, py: 0.5 }}>
                  <ListItemIcon sx={{ color: active ? "primary.main" : "text.secondary" }}>{r.icon}</ListItemIcon>
                  <ListItemText primary={r.title} secondary={r.subtitle} slotProps={{ primary: { sx: { fontSize: 13.5, fontWeight: 600 } }, secondary: { sx: { fontSize: 12 } } }} />
                  {active && <ArrowForwardRoundedIcon sx={{ fontSize: 16, color: "text.disabled" }} />}
                </ListItemButton>
              );
            })}
          </List>
        ))}
      </Box>
    </Dialog>
  );
}
