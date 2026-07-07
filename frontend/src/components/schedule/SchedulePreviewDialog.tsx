import { Box, Dialog, DialogContent, DialogTitle, IconButton, Typography, Chip, Paper } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import EventNoteRoundedIcon from "@mui/icons-material/EventNoteRounded";
import TvRoundedIcon from "@mui/icons-material/TvRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";

import type { Schedule } from "../../types/schedule";
import type { Playlist } from "../../types/playlist";
import type { Device } from "../../types/device";

interface Props {
  open: boolean;
  schedule: Schedule | null;
  playlists: Playlist[];
  devices: Device[];
  onClose: () => void;
}

export default function SchedulePreviewDialog({ open, schedule, playlists, devices, onClose }: Props) {
  if (!schedule) return null;
  const playlist = playlists.find(p => p.id === schedule.playlistId);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: "20px" } } }}>
      <DialogTitle sx={{ p: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: "12px", bgcolor: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <EventNoteRoundedIcon sx={{ color: "#D97706" }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 18 }}>{schedule.name}</Typography>
            <Typography sx={{ color: "#64748B", fontSize: 13, mt: 0.25 }}>Schedule Details</Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} sx={{ color: "#94A3B8" }}><CloseRoundedIcon /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3, pt: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        
        <Box sx={{ display: "flex", gap: 1 }}>
          <Chip label={`Status: ${schedule.status}`} size="small" sx={{ fontWeight: 600, bgcolor: "#F1F5F9", color: "#475569" }} />
          <Chip label={`Priority: ${schedule.priority}`} size="small" sx={{ fontWeight: 600, bgcolor: "#F1F5F9", color: "#475569" }} />
        </Box>

        <Paper elevation={0} sx={{ p: 2, borderRadius: "12px", border: "1px solid #E2E8F0", display: "flex", flexDirection: "column", gap: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <EventNoteRoundedIcon sx={{ color: "#64748B", fontSize: 20 }} />
            <Box>
              <Typography sx={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Active Dates</Typography>
              <Typography sx={{ fontWeight: 500, fontSize: 14 }}>{schedule.startDate} to {schedule.endDate}</Typography>
            </Box>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <AccessTimeRoundedIcon sx={{ color: "#64748B", fontSize: 20 }} />
            <Box>
              <Typography sx={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Time Window & Repeat</Typography>
              <Typography sx={{ fontWeight: 500, fontSize: 14 }}>{schedule.startTime} - {schedule.endTime} ({schedule.repeat})</Typography>
            </Box>
          </Box>
        </Paper>

        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 1.5 }}>Assigned Playlist</Typography>
          <Paper elevation={0} sx={{ p: 1.5, borderRadius: "12px", border: "1px solid #E2E8F0", bgcolor: "#F8FAFC" }}>
            <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{playlist?.name || "Unknown Playlist"}</Typography>
            <Typography sx={{ fontSize: 12, color: "#64748B", mt: 0.5 }}>{playlist?.items.length || 0} items configured</Typography>
          </Paper>
        </Box>

        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 1.5 }}>Target Devices ({schedule.deviceIds.length})</Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, maxHeight: 150, overflowY: "auto", p: 0.5 }}>
            {schedule.deviceIds.map(id => {
              const d = devices.find(x => x.id === id);
              return (
                <Chip key={id} icon={<TvRoundedIcon />} label={d?.name || id} size="small" variant="outlined" />
              );
            })}
          </Box>
        </Box>

      </DialogContent>
    </Dialog>
  );
}
