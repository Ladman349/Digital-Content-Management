import { Box, Skeleton } from "@mui/material";

import TvRoundedIcon from "@mui/icons-material/TvRounded";
import PermMediaRoundedIcon from "@mui/icons-material/PermMediaRounded";
import PlaylistPlayRoundedIcon from "@mui/icons-material/PlaylistPlayRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";

import StatCard from "./StatCard";
import { useDevices, usePlaylists, useSchedules, useMedia } from "../../hooks/queries";

export default function StatsGrid() {
  const { data: devices = [], isLoading: devLoading } = useDevices();
  const { data: playlists = [], isLoading: playLoading } = usePlaylists();
  const { data: schedules = [], isLoading: schedLoading } = useSchedules();
  const { data: media = [], isLoading: mediaLoading } = useMedia();

  const loading = devLoading || playLoading || schedLoading || mediaLoading;

  if (loading && !devices.length && !playlists.length) {
    return (
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "repeat(2, 1fr)",
            sm: "repeat(2, 1fr)",
            lg: "repeat(4, 1fr)",
          },
          gap: { xs: 1.5, sm: 2, md: 3 },
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            variant="rounded"
            height={110}
            sx={{ borderRadius: { xs: "12px", sm: "16px" } }}
          />
        ))}
      </Box>
    );
  }

  const onlineCount = devices.filter((d) => d.status === "Online").length;
  const offlineCount = devices.filter((d) => d.status === "Offline").length;

  const publishedCount = playlists.filter((p) => p.status === "Published").length;
  const draftPlaylistCount = playlists.filter((p) => p.status === "Draft").length;

  const activeSchedules = schedules.filter((s) => s.status === "Active").length;
  const pausedSchedules = schedules.filter((s) => s.status === "Paused").length;

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "repeat(2, 1fr)",
          sm: "repeat(2, 1fr)",
          lg: "repeat(4, 1fr)",
        },
        gap: { xs: 1.5, sm: 2, md: 3 },
      }}
    >
      <StatCard
        title="Total Devices"
        value={devices.length}
        icon={<TvRoundedIcon sx={{ fontSize: { xs: 20, sm: 24 } }} />}
        color="#6C4CF1"
        subtitle={`${onlineCount} Online · ${offlineCount} Off`}
      />

      <StatCard
        title="Media Files"
        value={media.length}
        icon={<PermMediaRoundedIcon sx={{ fontSize: { xs: 20, sm: 24 } }} />}
        color="#0EA5E9"
        subtitle="Active assets"
      />

      <StatCard
        title="Playlists"
        value={playlists.length}
        icon={<PlaylistPlayRoundedIcon sx={{ fontSize: { xs: 20, sm: 24 } }} />}
        color="#F59E0B"
        subtitle={`${publishedCount} Pub · ${draftPlaylistCount} Draft`}
      />

      <StatCard
        title="Schedules"
        value={schedules.length}
        icon={<CalendarMonthRoundedIcon sx={{ fontSize: { xs: 20, sm: 24 } }} />}
        color="#10B981"
        subtitle={`${activeSchedules} Active · ${pausedSchedules} Paused`}
      />
    </Box>
  );
}