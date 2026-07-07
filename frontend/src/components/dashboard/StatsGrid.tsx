import { useSnackbar } from "notistack";
import { useEffect, useState } from "react";
import { Box, Skeleton } from "@mui/material";

import TvRoundedIcon from "@mui/icons-material/TvRounded";
import PermMediaRoundedIcon from "@mui/icons-material/PermMediaRounded";
import PlaylistPlayRoundedIcon from "@mui/icons-material/PlaylistPlayRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";

import StatCard from "./StatCard";

import { DeviceService } from "../../services/DeviceService";
import { PlaylistService } from "../../services/PlaylistService";
import { ScheduleService } from "../../services/ScheduleService";
import { MediaService } from "../../services/MediaService";

import type { Device } from "../../types/device";
import type { Playlist } from "../../types/playlist";
import type { Schedule } from "../../types/schedule";
import type { MediaItem } from "../../types/media";

interface Stats {
  devices: Device[];
  playlists: Playlist[];
  schedules: Schedule[];
  media: MediaItem[];
}

export default function StatsGrid() {
  const { enqueueSnackbar } = useSnackbar();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [devices, playlists, schedules, media] = await Promise.all([
          DeviceService.getDevices(),
          PlaylistService.getPlaylists(),
          ScheduleService.getSchedules(),
          MediaService.getMedia(),
        ]);
        setStats({ devices, playlists, schedules, media });
      } catch (error: any) {
        enqueueSnackbar(error.message || "Failed to fetch dashboard stats:", { variant: "error" });
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  if (loading) {
    return (
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "1fr 1fr",
            lg: "1fr 1fr 1fr 1fr",
          },
          gap: 3,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            variant="rounded"
            height={120}
            sx={{ borderRadius: "16px" }}
          />
        ))}
      </Box>
    );
  }

  if (!stats) return null;

  const { devices, playlists, schedules, media } = stats;

  const onlineCount = devices.filter((d) => d.status === "Online").length;
  const offlineCount = devices.filter((d) => d.status === "Offline").length;
  const idleCount = devices.filter((d) => d.status === "Idle").length;

  const publishedCount = playlists.filter((p) => p.status === "Published").length;
  const draftPlaylistCount = playlists.filter((p) => p.status === "Draft").length;
  const archivedCount = playlists.filter((p) => p.status === "Archived").length;

  const activeSchedules = schedules.filter((s) => s.status === "Active").length;
  const pausedSchedules = schedules.filter((s) => s.status === "Paused").length;
  const draftSchedules = schedules.filter((s) => s.status === "Draft").length;

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          sm: "1fr 1fr",
          lg: "1fr 1fr 1fr 1fr",
        },
        gap: 3,
      }}
    >
      <StatCard
        title="Total Devices"
        value={devices.length}
        icon={<TvRoundedIcon sx={{ fontSize: 26 }} />}
        color="#6C4CF1"
        subtitle={`${onlineCount} Online · ${offlineCount} Offline · ${idleCount} Idle`}
      />

      <StatCard
        title="Media Files"
        value={media.length}
        icon={<PermMediaRoundedIcon sx={{ fontSize: 26 }} />}
        color="#3B82F6"
      />

      <StatCard
        title="Playlists"
        value={playlists.length}
        icon={<PlaylistPlayRoundedIcon sx={{ fontSize: 26 }} />}
        color="#F59E0B"
        subtitle={`${publishedCount} Published · ${draftPlaylistCount} Draft · ${archivedCount} Archived`}
      />

      <StatCard
        title="Schedules"
        value={schedules.length}
        icon={<CalendarMonthRoundedIcon sx={{ fontSize: 26 }} />}
        color="#10B981"
        subtitle={`${activeSchedules} Active · ${pausedSchedules} Paused · ${draftSchedules} Draft`}
      />
    </Box>
  );
}