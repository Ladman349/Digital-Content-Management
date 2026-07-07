import {
  Box,
  Button,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

import TvRoundedIcon from "@mui/icons-material/TvRounded";
import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";
import PlaylistPlayRoundedIcon from "@mui/icons-material/PlaylistPlayRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";

import DashboardCard from "../common/DashboardCard";

export default function QuickActions() {
  const navigate = useNavigate();

  const actions = [
    {
      title: "Add Device",
      icon: <TvRoundedIcon />,
      action: () => navigate("/devices", { state: { openCreateDialog: true } }),
    },
    {
      title: "Upload Media",
      icon: <CloudUploadRoundedIcon />,
      action: () => navigate("/media", { state: { openUploadDialog: true } }),
    },
    {
      title: "Create Playlist",
      icon: <PlaylistPlayRoundedIcon />,
      action: () => navigate("/playlists", { state: { openCreateDialog: true } }),
    },
    {
      title: "Schedule",
      icon: <EventRoundedIcon />,
      action: () => navigate("/schedule", { state: { openCreateDialog: true } }),
    },
  ];

  return (
    <DashboardCard>
      <Typography
        sx={{
          fontSize: 20,
          fontWeight: 700,
          mb: 3,
        }}
      >
        Quick Actions
      </Typography>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 2,
        }}
      >
        {actions.map((item) => (
          <Button
            key={item.title}
            variant="outlined"
            onClick={item.action}
            sx={{
              height: 90,
              borderRadius: "16px",
              borderColor: "#E5E7EB",
              textTransform: "none",
              display: "flex",
              flexDirection: "column",
              gap: 1,
              color: "#475569",

              "&:hover": {
                bgcolor: "#F8FAFF",
                borderColor: "#6C4CF1",
                color: "#6C4CF1",
              },
            }}
          >
            {item.icon}

            <Typography
              sx={{
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              {item.title}
            </Typography>
          </Button>
        ))}
      </Box>

      <Box
        sx={{
          mt: 3,
          p: 2.5,
          borderRadius: "16px",
          bgcolor: "#F8FAFF",
          border: "1px solid #EEF2FF",
        }}
      >
        <Typography
          sx={{
            fontWeight: 700,
            mb: 1,
          }}
        >
          💡 Productivity Tip
        </Typography>

        <Typography
          sx={{
            color: "#64748B",
            fontSize: 14,
            lineHeight: 1.7,
          }}
        >
          Schedule playlists ahead of time to automatically update content across all connected displays without manual intervention.
        </Typography>
      </Box>
    </DashboardCard>
  );
}