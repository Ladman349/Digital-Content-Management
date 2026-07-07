import { useState, useEffect } from "react";
import { Dialog, DialogContent, Box, IconButton, Typography } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import ArrowForwardIosRoundedIcon from "@mui/icons-material/ArrowForwardIosRounded";

import type { PlaylistItem } from "../../types/playlist";
import type { MediaItem } from "../../types/media";

interface Props {
  open: boolean;
  items: PlaylistItem[];
  mediaLibrary: MediaItem[];
  onClose: () => void;
}

export default function PlaylistPreviewDialog({ open, items, mediaLibrary, onClose }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (open) setCurrentIndex(0);
  }, [open]);

  if (!open || items.length === 0) return null;

  const currentItem = items[currentIndex];
  const media = mediaLibrary.find(m => m.id === currentItem.mediaId);

  const handleNext = () => setCurrentIndex(p => Math.min(p + 1, items.length - 1));
  const handlePrev = () => setCurrentIndex(p => Math.max(p - 1, 0));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth slotProps={{ paper: { sx: { bgcolor: "#000", borderRadius: 0, m: 0, height: "100vh", maxHeight: "100vh" } } }}>
      <IconButton onClick={onClose} sx={{ position: "absolute", top: 16, right: 16, color: "#fff", zIndex: 10, bgcolor: "rgba(255,255,255,0.1)" }}>
        <CloseRoundedIcon />
      </IconButton>
      
      <DialogContent sx={{ p: 0, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        {media ? (
          media.type === "Video" ? (
            <video src={media.originalFile} autoPlay controls style={{ maxWidth: "100%", maxHeight: "100%" }} />
          ) : (
            <img src={media.originalFile} alt={media.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          )
        ) : (
          <Typography color="white">Media not found</Typography>
        )}

        <Box sx={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 3, bgcolor: "rgba(0,0,0,0.6)", px: 3, py: 1.5, borderRadius: "30px", backdropFilter: "blur(10px)" }}>
          <IconButton onClick={handlePrev} disabled={currentIndex === 0} sx={{ color: "#fff", "&.Mui-disabled": { color: "rgba(255,255,255,0.3)" } }}>
            <ArrowBackIosNewRoundedIcon fontSize="small" />
          </IconButton>
          <Typography sx={{ color: "#fff", fontWeight: 600 }}>
            Item {currentIndex + 1} of {items.length} (Duration: {currentItem.duration}s)
          </Typography>
          <IconButton onClick={handleNext} disabled={currentIndex === items.length - 1} sx={{ color: "#fff", "&.Mui-disabled": { color: "rgba(255,255,255,0.3)" } }}>
            <ArrowForwardIosRoundedIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
