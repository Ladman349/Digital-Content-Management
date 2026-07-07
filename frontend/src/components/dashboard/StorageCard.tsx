import { useSnackbar } from "notistack";
import { Box, LinearProgress, Typography, CircularProgress } from "@mui/material";
import { useEffect, useState } from "react";
import DashboardCard from "../common/DashboardCard";
import { MediaService } from "../../services/MediaService";

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default function StorageCard() {
  const { enqueueSnackbar } = useSnackbar();
  const [totalFiles, setTotalFiles] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    MediaService.getMedia()
      .then((media) => {
        setTotalFiles(media.length);
        const bytes = media.reduce((sum, item) => sum + (item.size || (item as any).fileSizeBytes || 0), 0);
        setTotalBytes(bytes);
        setLoading(false);
      })
      .catch((err) => {
        enqueueSnackbar(err.message || "Failed to load media for storage", { variant: "error" });
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <DashboardCard>
        <Typography sx={{ fontSize: 20, fontWeight: 700, mb: 3 }}>Storage Overview</Typography>
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: 150 }}>
          <CircularProgress />
        </Box>
      </DashboardCard>
    );
  }

  return (
    <DashboardCard>
      <Typography sx={{ fontSize: 20, fontWeight: 700, mb: 3 }}>Storage Overview</Typography>
      
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <Box>
            <Typography sx={{ color: "#64748B", fontSize: 14, mb: 0.5 }}>Total Media Files</Typography>
            <Typography sx={{ fontSize: 32, fontWeight: 800, lineHeight: 1 }}>{totalFiles}</Typography>
          </Box>
          <Box sx={{ textAlign: "right" }}>
            <Typography sx={{ color: "#64748B", fontSize: 14, mb: 0.5 }}>Storage Used</Typography>
            <Typography sx={{ fontSize: 24, fontWeight: 700, color: "#6C4CF1", lineHeight: 1 }}>
              {formatBytes(totalBytes)}
            </Typography>
          </Box>
        </Box>

        {totalBytes > 0 && (
          <Box sx={{ width: "100%", mt: 1 }}>
            <LinearProgress
              variant="determinate"
              value={100} // Since we don't have a hard limit on the backend, we just show a bar for visual appeal. Wait, instructions said "LinearProgress bar showing used percentage (if a total is not available, just show the count and size without a progress bar)"
              sx={{ display: 'none' }} 
            />
          </Box>
        )}
      </Box>
    </DashboardCard>
  );
}