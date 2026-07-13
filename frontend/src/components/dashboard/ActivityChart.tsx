import { useSnackbar } from "notistack";
import { Box, Typography, CircularProgress, Divider, Tooltip } from "@mui/material";
import { useEffect, useState } from "react";
import DashboardCard from "../common/DashboardCard";
import { DeviceService } from "../../services/DeviceService";
import { PlaylistService } from "../../services/PlaylistService";
import { ScheduleService } from "../../services/ScheduleService";
import { MediaService } from "../../services/MediaService";
import TvRoundedIcon from "@mui/icons-material/TvRounded";
import PlaylistPlayRoundedIcon from "@mui/icons-material/PlaylistPlayRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import PermMediaRoundedIcon from "@mui/icons-material/PermMediaRounded";
import { getRelativeTime, formatDateTime } from "../../utils/date";

interface ActivityEvent {
  id: string;
  timestamp: number;
  description: string;
  type: "device" | "playlist" | "schedule" | "media";
}

export default function ActivityChart() {
  const { enqueueSnackbar } = useSnackbar();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      DeviceService.getDevices(),
      PlaylistService.getPlaylists(),
      ScheduleService.getSchedules(),
      MediaService.getMedia(),
    ])
      .then(([devices, playlists, schedules, media]) => {
        const allEvents: ActivityEvent[] = [];

        devices.forEach((d) => {
          allEvents.push({
            id: `dev-${d.id}`,
            timestamp: d.lastSeenMs || 0,
            description: `Device "${d.name}" registered or seen`,
            type: "device",
          });
        });

        playlists.forEach((p) => {
          allEvents.push({
            id: `pl-${p.id}`,
            timestamp: p.updatedAt || 0,
            description: `Playlist "${p.name}" updated`,
            type: "playlist",
          });
        });

        schedules.forEach((s) => {
          allEvents.push({
            id: `sch-${s.id}`,
            timestamp: (s as any).createdAt || (s as any).updatedAt || 0,
            description: `Schedule "${s.name}" created/updated`,
            type: "schedule",
          });
        });

        media.forEach((m) => {
          allEvents.push({
            id: `med-${m.id}`,
            timestamp: m.uploadedAt || 0,
            description: `Media "${m.name}" uploaded`,
            type: "media",
          });
        });

        allEvents.sort((a, b) => b.timestamp - a.timestamp);
        setEvents(allEvents.slice(0, 10));
        setLoading(false);
      })
      .catch((err) => {
        enqueueSnackbar(err.message || "Failed to load activity", { variant: "error" });
        setLoading(false);
      });
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case "device": return <TvRoundedIcon sx={{ color: "#3B82F6" }} />;
      case "playlist": return <PlaylistPlayRoundedIcon sx={{ color: "#6C4CF1" }} />;
      case "schedule": return <CalendarMonthRoundedIcon sx={{ color: "#10B981" }} />;
      case "media": return <PermMediaRoundedIcon sx={{ color: "#F59E0B" }} />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <DashboardCard>
        <Typography sx={{ fontSize: 20, fontWeight: 700, mb: 3 }}>Recent Activity</Typography>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: 200 }}>
          <CircularProgress />
        </Box>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard>
      <Typography sx={{ fontSize: 20, fontWeight: 700, mb: 3 }}>Recent Activity</Typography>
      
      {events.length === 0 ? (
        <Typography sx={{ color: "#94A3B8", textAlign: "center", py: 4 }}>No recent activity</Typography>
      ) : (
        <Box sx={{ maxHeight: 350, overflowY: "auto", pr: 1 }}>
          {events.map((event, index) => (
            <Box key={event.id}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 1.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: "50%", bgcolor: "#F8FAFC" }}>
                    {getIcon(event.type)}
                  </Box>
                  <Typography sx={{ fontWeight: 500, fontSize: 14 }}>{event.description}</Typography>
                </Box>
                <Tooltip title={formatDateTime(event.timestamp)} arrow>
                  <Typography sx={{ color: "#94A3B8", fontSize: 13, whiteSpace: "nowrap", ml: 2, cursor: "help", borderBottom: "1px dashed #CBD5E1" }}>
                    {getRelativeTime(event.timestamp)}
                  </Typography>
                </Tooltip>
              </Box>
              {index < events.length - 1 && <Divider />}
            </Box>
          ))}
        </Box>
      )}
    </DashboardCard>
  );
}