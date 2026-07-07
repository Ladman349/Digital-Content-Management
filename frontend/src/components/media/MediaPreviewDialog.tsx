import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from "@mui/material";

import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { formatBytes, formatDuration } from "./utils";
import type { MediaItem } from "../../types/media";

interface Props {
  item: MediaItem | null;
  open: boolean;
  onClose: () => void;
}

export default function MediaPreviewDialog({ item, open, onClose }: Props) {
  if (!item) return null;

  const isVideo = item.type === "Video";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: "20px",
            bgcolor: "#0F172A",
            color: "#fff",
          },
        },
      }}
    >
      <DialogTitle sx={{ p: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 16 }}>{item.name}</Typography>
          <Typography sx={{ color: "#94A3B8", fontSize: 13, mt: 0.25 }}>
            {item.dimensions} • {formatBytes(item.size)}
            {isVideo && ` • ${formatDuration(item.duration)}`}
            {` • ${item.category}`}
          </Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: "#94A3B8", "&:hover": { bgcolor: "rgba(255,255,255,0.1)", color: "#fff" } }}>
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300, bgcolor: "#000" }}>
        {isVideo ? (
          <video
            src={item.originalFile}
            controls
            autoPlay
            style={{ maxWidth: "100%", maxHeight: "70vh", outline: "none" }}
          />
        ) : (
          <img
            src={item.originalFile}
            alt={item.name}
            style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain" }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
