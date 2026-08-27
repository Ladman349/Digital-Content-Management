import { Box, Chip, Divider, Typography, CircularProgress } from "@mui/material";
import DashboardCard from "../common/DashboardCard";
import { useDevices, usePlaylists } from "../../hooks/queries";

export default function CurrentPlayback() {
  const { data: devices = [], isLoading: devLoading } = useDevices();
  const { data: playlists = [], isLoading: playLoading } = usePlaylists();
  const loading = devLoading || playLoading;

  if (loading && !devices.length) {
    return (
      <DashboardCard>
        <Typography sx={{ fontSize: 20, fontWeight: 700, mb: 3 }}>Current Playback</Typography>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: 200 }}>
          <CircularProgress />
        </Box>
      </DashboardCard>
    );
  }

  const onlineDevices = devices.filter((d) => d.status === "Online");

  return (
    <DashboardCard>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography sx={{ fontSize: 20, fontWeight: 700 }}>Current Playback</Typography>
      </Box>

      {onlineDevices.length === 0 ? (
        <Typography sx={{ color: "#94A3B8", textAlign: "center", py: 4 }}>
          No devices currently online
        </Typography>
      ) : (
        <Box sx={{ maxHeight: 400, overflowY: "auto", pr: 1 }}>
          {onlineDevices.map((device, index) => {
            const playlistId = (device as any).currentPlaylistId;
            const playlist = playlists.find((p) => p.id === playlistId);
            const isPlaying = !!playlist;

            return (
              <Box key={device.id}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    py: 1.5,
                  }}
                >
                  <Box>
                    <Typography sx={{ fontWeight: 600 }}>{device.name}</Typography>
                    <Typography sx={{ fontSize: 13, color: "#94A3B8" }}>
                      {device.location}
                    </Typography>
                  </Box>

                  <Chip
                    label={isPlaying ? playlist?.name : "No Playlist"}
                    size="small"
                    color={isPlaying ? "primary" : "default"}
                    sx={{ fontWeight: 600 }}
                  />
                </Box>

                {index < onlineDevices.length - 1 && <Divider />}
              </Box>
            );
          })}
        </Box>
      )}
    </DashboardCard>
  );
}