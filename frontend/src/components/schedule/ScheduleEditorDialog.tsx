import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import { useSnackbar } from "notistack";

import type { Schedule, ScheduleRepeat, SchedulePriority, ScheduleStatus } from "../../types/schedule";
import type { Playlist } from "../../types/playlist";
import type { Device } from "../../types/device";
import PlaylistSelector from "./PlaylistSelector";
import DeviceSelector from "./DeviceSelector";
import ConflictWarning from "./ConflictWarning";
import { findConflicts } from "./utils";

interface Props {
  open: boolean;
  mode: "create" | "edit";
  initialSchedule?: Schedule;
  existingSchedules: Schedule[];
  playlists: Playlist[];
  devices: Device[];
  onClose: () => void;
  onSave: (schedule: Schedule) => void;
}

const defaultSchedule: Schedule = {
  id: "",
  name: "",
  playlistId: "",
  deviceIds: [],
  startDate: new Date().toISOString().split("T")[0],
  endDate: new Date().toISOString().split("T")[0],
  startTime: "09:00",
  endTime: "17:00",
  repeat: "Once",
  priority: "Normal",
  status: "Draft",
};

export default function ScheduleEditorDialog({ open, mode, initialSchedule, existingSchedules, playlists, devices, onClose, onSave }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const [formData, setFormData] = useState<Schedule>(defaultSchedule);

  useEffect(() => {
    if (open) {
      setFormData(initialSchedule ? { ...initialSchedule } : { ...defaultSchedule, id: `SCH-NEW-${Date.now()}` });
    }
  }, [open, initialSchedule]);

  const conflicts = findConflicts(existingSchedules, formData);

  const handleSave = () => {
    if (!formData.name.trim()) {
      enqueueSnackbar("Schedule name is required", { variant: "error" });
      return;
    }
    if (!formData.playlistId) {
      enqueueSnackbar("Please select a playlist", { variant: "error" });
      return;
    }
    if (formData.deviceIds.length === 0) {
      enqueueSnackbar("Please select at least one device", { variant: "error" });
      return;
    }
    if (formData.startDate > formData.endDate) {
      enqueueSnackbar("End date must be after start date", { variant: "error" });
      return;
    }
    if (formData.startTime >= formData.endTime) {
      enqueueSnackbar("End time must be after start time", { variant: "error" });
      return;
    }

    onSave(formData);
  };

  const title = mode === "create" ? "Create Schedule" : "Edit Schedule";

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth slotProps={{ paper: { sx: { borderRadius: "20px" } } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: "12px", bgcolor: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CalendarMonthRoundedIcon sx={{ color: "#D97706" }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 20 }}>{title}</Typography>
            <Typography sx={{ color: "#64748B", fontSize: 13, mt: 0.25 }}>Configure when and where a playlist should be displayed.</Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        <ConflictWarning conflicts={conflicts} />

        <Box sx={{ display: "flex", flexDirection: "column", gap: 3, pt: 1 }}>
          <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
            <TextField
              label="Schedule Name"
              fullWidth
              required
              value={formData.name}
              onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
            />
            <TextField
              select
              label="Status"
              sx={{ minWidth: 150, "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
              value={formData.status}
              onChange={(e) => setFormData(p => ({ ...p, status: e.target.value as ScheduleStatus }))}
            >
              <MenuItem value="Active">Active</MenuItem>
              <MenuItem value="Draft">Draft</MenuItem>
              <MenuItem value="Paused">Paused</MenuItem>
            </TextField>
          </Box>

          <PlaylistSelector
            playlists={playlists}
            value={formData.playlistId}
            onChange={(id) => setFormData(p => ({ ...p, playlistId: id }))}
          />

          <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", md: "row" } }}>
            <TextField
              type="date"
              label="Start Date"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              value={formData.startDate}
              onChange={(e) => setFormData(p => ({ ...p, startDate: e.target.value }))}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
            />
            <TextField
              type="date"
              label="End Date"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              value={formData.endDate}
              onChange={(e) => setFormData(p => ({ ...p, endDate: e.target.value }))}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
            />
          </Box>

          <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", md: "row" } }}>
            <TextField
              type="time"
              label="Start Time"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              value={formData.startTime}
              onChange={(e) => setFormData(p => ({ ...p, startTime: e.target.value }))}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
            />
            <TextField
              type="time"
              label="End Time"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              value={formData.endTime}
              onChange={(e) => setFormData(p => ({ ...p, endTime: e.target.value }))}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
            />
          </Box>

          <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
            <TextField
              select
              label="Repeat"
              fullWidth
              value={formData.repeat}
              onChange={(e) => setFormData(p => ({ ...p, repeat: e.target.value as ScheduleRepeat }))}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
            >
              {(["Once", "Daily", "Weekdays", "Weekends", "Weekly", "Monthly"] as ScheduleRepeat[]).map(r => (
                <MenuItem key={r} value={r}>{r}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Priority"
              fullWidth
              value={formData.priority}
              onChange={(e) => setFormData(p => ({ ...p, priority: e.target.value as SchedulePriority }))}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
            >
              {(["Emergency", "High", "Normal", "Low"] as SchedulePriority[]).map(r => (
                <MenuItem key={r} value={r}>{r}</MenuItem>
              ))}
            </TextField>
          </Box>

          <DeviceSelector
            devices={devices}
            value={formData.deviceIds}
            onChange={(ids) => setFormData(p => ({ ...p, deviceIds: ids }))}
          />

        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button type="button" onClick={onClose} sx={{ color: "#64748B", fontWeight: 600 }}>Cancel</Button>
        <Button type="button" variant="contained" onClick={handleSave} sx={{ bgcolor: "#D97706", "&:hover": { bgcolor: "#B45309" }, fontWeight: 700, borderRadius: "10px" }}>
          {mode === "create" ? "Create Schedule" : "Save Changes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
