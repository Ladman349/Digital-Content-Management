import { Box, Divider, Typography, CircularProgress, Tooltip } from "@mui/material";
import DashboardCard from "../common/DashboardCard";
import { useDevices } from "../../hooks/queries";
import type { Device } from "../../types/device";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import PauseCircleRoundedIcon from "@mui/icons-material/PauseCircleRounded";
import CloudOffRoundedIcon from "@mui/icons-material/CloudOffRounded";
import { getRelativeTime, formatDateTime } from "../../utils/date";

export default function DeviceStatusCard() {
  const { data: devices = [], isLoading: loading } = useDevices();

  if (loading && !devices.length) {
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
              <Tooltip title={formatDateTime((device as any).heartbeatAt || device.lastSeenMs)} arrow>
                <Typography sx={{ color: "#94A3B8", fontSize: 13, cursor: "help", borderBottom: "1px dashed #CBD5E1" }}>
                  {getRelativeTime((device as any).heartbeatAt || device.lastSeenMs)}
                </Typography>
              </Tooltip>
            </Box>
            {index < group.length - 1 && <Divider />}
          </Box>
        ))}
      </Box>
    );
  };

  return (
    <DashboardCard>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography sx={{ fontSize: 20, fontWeight: 700 }}>Device Health</Typography>
      </Box>

      {devices.length === 0 ? (
        <Typography sx={{ color: "#94A3B8", textAlign: "center", py: 4 }}>No devices found</Typography>
      ) : (
        <Box sx={{ maxHeight: 400, overflowY: "auto", pr: 1 }}>
          {renderGroup("Online", online, <CheckCircleRoundedIcon fontSize="small" />, "#22C55E")}
          {renderGroup("Idle", idle, <PauseCircleRoundedIcon fontSize="small" />, "#F59E0B")}
          {renderGroup("Offline", offline, <CloudOffRoundedIcon fontSize="small" />, "#EF4444")}
        </Box>
      )}
    </DashboardCard>
  );
}