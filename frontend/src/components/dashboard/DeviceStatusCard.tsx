import { useSnackbar } from "notistack";
import { Box, Divider, Typography, CircularProgress } from "@mui/material";
import { useEffect, useState } from "react";
import DashboardCard from "../common/DashboardCard";
import { DeviceService } from "../../services/DeviceService";
import type { Device } from "../../types/device";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import PauseCircleRoundedIcon from "@mui/icons-material/PauseCircleRounded";
import CloudOffRoundedIcon from "@mui/icons-material/CloudOffRounded";

function formatRelativeTime(heartbeatAt?: number | null): string {
  if (!heartbeatAt) return "Never";
  const seconds = Math.floor((Date.now() - heartbeatAt) / 1000);
  if (seconds < 10) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function DeviceStatusCard() {
  const { enqueueSnackbar } = useSnackbar();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    DeviceService.getDevices()
      .then((data) => {
        setDevices(data);
        setLoading(false);
      })
      .catch((err) => {
        enqueueSnackbar(err.message || "Failed to load devices", { variant: "error" });
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <DashboardCard>
        <Typography sx={{ fontSize: 20, fontWeight: 700, mb: 3 }}>Device Health</Typography>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: 200 }}>
          <CircularProgress />
        </Box>
      </DashboardCard>
    );
  }

  const online = devices.filter((d) => d.status === "Online");
  const idle = devices.filter((d) => d.status === "Idle");
  const offline = devices.filter((d) => d.status === "Offline");

  const renderGroup = (title: string, group: Device[], icon: React.ReactNode, color: string) => {
    if (group.length === 0) return null;
    return (
      <Box sx={{ mb: 2 }}>
        <Typography sx={{ fontWeight: 700, mb: 1.5, color: "#475569" }}>{title}</Typography>
        {group.map((device, index) => (
          <Box key={device.id}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Box sx={{ display: "flex", color }}>{icon}</Box>
                <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{device.name}</Typography>
              </Box>
              <Typography sx={{ color: "#94A3B8", fontSize: 13 }}>
                {formatRelativeTime((device as any).heartbeatAt || device.lastSeenMs)}
              </Typography>
            </Box>
            {index < group.length - 1 && <Divider sx={{ my: 0.5 }} />}
          </Box>
        ))}
      </Box>
    );
  };

  return (
    <DashboardCard>
      <Typography sx={{ fontSize: 20, fontWeight: 700, mb: 3 }}>Device Health</Typography>
      
      {devices.length === 0 ? (
        <Typography sx={{ color: "#94A3B8", textAlign: "center", py: 4 }}>No devices found</Typography>
      ) : (
        <Box sx={{ maxHeight: 400, overflowY: "auto", pr: 1 }}>
          {renderGroup("Online", online, <CheckCircleRoundedIcon fontSize="small" />, "#10B981")}
          {online.length > 0 && (idle.length > 0 || offline.length > 0) && <Divider sx={{ my: 2 }} />}
          {renderGroup("Idle", idle, <PauseCircleRoundedIcon fontSize="small" />, "#F59E0B")}
          {idle.length > 0 && offline.length > 0 && <Divider sx={{ my: 2 }} />}
          {renderGroup("Offline", offline, <CloudOffRoundedIcon fontSize="small" />, "#EF4444")}
        </Box>
      )}
    </DashboardCard>
  );
}