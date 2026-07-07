import { useSnackbar } from "notistack";
import { Box, Chip, Divider, Typography, CircularProgress } from "@mui/material";
import { useEffect, useState } from "react";
import DashboardCard from "../common/DashboardCard";
import { DeviceService } from "../../services/DeviceService";
import { PlaylistService } from "../../services/PlaylistService";
import type { Device } from "../../types/device";
import type { Playlist } from "../../types/playlist";

export default function CurrentPlayback() {
  const { enqueueSnackbar } = useSnackbar();
  const [devices, setDevices] = useState<Device[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([DeviceService.getDevices(), PlaylistService.getPlaylists()])
      .then(([devs, plists]) => {
        setDevices(devs);
        setPlaylists(plists);
        setLoading(false);
      })
      .catch((err) => {
        enqueueSnackbar(err.message || "Failed to load playback data", { variant: "error" });
        setLoading(false);
      });
  }, []);

  if (loading) {
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
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 1.5 }}>
                  <Box>
                    <Typography sx={{ fontWeight: 700 }}>{device.name}</Typography>
                    <Typography sx={{ color: "#94A3B8", fontSize: 13, mt: 0.3, fontStyle: isPlaying ? "normal" : "italic" }}>
                      {isPlaying ? playlist.name : "No Active Playlist"}
                    </Typography>
                  </Box>
                  <Chip
                    label={isPlaying ? "Playing" : "Idle"}
                    color={isPlaying ? "success" : "warning"}
                    sx={{ borderRadius: "8px", fontWeight: 600 }}
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