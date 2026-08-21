import { Box, Chip, Divider, Typography, CircularProgress, Tooltip } from "@mui/material";
import PlaylistPlayRoundedIcon from "@mui/icons-material/PlaylistPlayRounded";
import DashboardCard from "../common/DashboardCard";
import { usePlaylists } from "../../hooks/queries";
import { getRelativeTime, formatDateTime } from "../../utils/date";

export default function RecentPlaylists() {
  const { data: allPlaylists = [], isLoading: loading } = usePlaylists();

  if (loading && !allPlaylists.length) {
    return (
      <DashboardCard>
        <Typography sx={{ fontSize: 20, fontWeight: 700, mb: 3 }}>Recent Playlists</Typography>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: 200 }}>
          <CircularProgress />
        </Box>
      </DashboardCard>
    );
  }

  const playlists = [...allPlaylists]
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 5);

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
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: "10px",
                      bgcolor: "#EEF2FF",
                      color: "#6366F1",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <PlaylistPlayRoundedIcon />
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 600 }}>{playlist.name}</Typography>
                    <Tooltip title={playlist.updatedAt ? formatDateTime(playlist.updatedAt) : ""} arrow>
                      <Typography sx={{ fontSize: 13, color: "#94A3B8" }}>
                        Updated {getRelativeTime(playlist.updatedAt || 0)}
                      </Typography>
                    </Tooltip>
                  </Box>
                </Box>

                <Chip
                  label={playlist.status}
                  size="small"
                  color={getStatusColor(playlist.status) as any}
                  sx={{ fontWeight: 600 }}
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