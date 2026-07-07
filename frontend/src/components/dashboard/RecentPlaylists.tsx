import { useSnackbar } from "notistack";
import { Box, Chip, Divider, Typography, CircularProgress } from "@mui/material";
import { useEffect, useState } from "react";
import PlaylistPlayRoundedIcon from "@mui/icons-material/PlaylistPlayRounded";
import DashboardCard from "../common/DashboardCard";
import { PlaylistService } from "../../services/PlaylistService";
import type { Playlist } from "../../types/playlist";

function formatRelativeTime(ms: number): string {
  if (!ms) return "Never";
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function RecentPlaylists() {
  const { enqueueSnackbar } = useSnackbar();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    PlaylistService.getPlaylists()
      .then((data) => {
        const sorted = [...data].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        setPlaylists(sorted.slice(0, 5));
        setLoading(false);
      })
      .catch((err) => {
        enqueueSnackbar(err.message || "Failed to load playlists", { variant: "error" });
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <DashboardCard>
        <Typography sx={{ fontSize: 20, fontWeight: 700, mb: 3 }}>Recent Playlists</Typography>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: 200 }}>
          <CircularProgress />
        </Box>
      </DashboardCard>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Published": return "success";
      case "Draft": return "warning";
      case "Archived": return "default";
      default: return "default";
    }
  };

  return (
    <DashboardCard>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography sx={{ fontSize: 20, fontWeight: 700 }}>Recent Playlists</Typography>
      </Box>

      {playlists.length === 0 ? (
        <Typography sx={{ color: "#94A3B8", textAlign: "center", py: 4 }}>No playlists found</Typography>
      ) : (
        <Box sx={{ maxHeight: 400, overflowY: "auto", pr: 1 }}>
          {playlists.map((playlist, index) => (
            <Box key={playlist.id}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 1.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: "12px", bgcolor: "#EEF2FF", color: "#6C4CF1" }}>
                    <PlaylistPlayRoundedIcon />
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 700 }}>{playlist.name}</Typography>
                    <Typography sx={{ color: "#94A3B8", fontSize: 13, mt: 0.3 }}>
                      {playlist.items?.length || 0} items • {formatRelativeTime(playlist.updatedAt)}
                    </Typography>
                  </Box>
                </Box>
                <Chip
                  label={playlist.status}
                  color={getStatusColor(playlist.status) as any}
                  sx={{ borderRadius: "8px", fontWeight: 600 }}
                />
              </Box>
              {index < playlists.length - 1 && <Divider />}
            </Box>
          ))}
        </Box>
      )}
    </DashboardCard>
  );
}