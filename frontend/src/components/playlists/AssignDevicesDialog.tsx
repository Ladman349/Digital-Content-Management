import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Typography,
} from "@mui/material";
import TvRoundedIcon from "@mui/icons-material/TvRounded";

import type { Device } from "../../types/device";

interface Props {
  open: boolean;
  devices: Device[];
  initialAssignedIds: string[];
  onClose: () => void;
  onSave: (ids: string[]) => void;
}

export default function AssignDevicesDialog({ open, devices, initialAssignedIds, onClose, onSave }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) setSelectedIds(initialAssignedIds);
  }, [open, initialAssignedIds]);

  const handleToggle = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: "20px" } } }}>
      <DialogTitle>
        <Typography sx={{ fontWeight: 700, fontSize: 20 }}>Assign Devices</Typography>
        <Typography sx={{ color: "#64748B", fontSize: 13, mt: 0.5 }}>
          Select which displays should play this sequence.
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        <List sx={{ px: 2 }}>
          {devices.map(device => {
            const isSelected = selectedIds.includes(device.id);
            return (
              <ListItem
                key={device.id}
                onClick={() => handleToggle(device.id)}
                sx={{
                  borderRadius: "12px",
                  mb: 1,
                  border: "1px solid",
                  borderColor: isSelected ? "#10B981" : "#E2E8F0",
                  bgcolor: isSelected ? "#F0FDF4" : "#fff",
                  cursor: "pointer",
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <Checkbox
                    checked={isSelected}
                    edge="start"
                    disableRipple
                    sx={{ color: isSelected ? "#10B981" : undefined, "&.Mui-checked": { color: "#10B981" } }}
                  />
                </ListItemIcon>
                <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
                  <TvRoundedIcon sx={{ color: "#64748B" }} />
                  <ListItemText
                    primary={<Typography sx={{ fontWeight: 600, color: "#1E293B" }}>{device.name}</Typography>}
                    secondary={`${device.location} • ${device.status}`}
                  />
                </Box>
              </ListItem>
            );
          })}
        </List>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose} sx={{ color: "#64748B", fontWeight: 600 }}>Cancel</Button>
        <Button onClick={() => onSave(selectedIds)} variant="contained" sx={{ bgcolor: "#10B981", "&:hover": { bgcolor: "#059669" }, fontWeight: 700, borderRadius: "10px" }}>
          Save Assignments
        </Button>
      </DialogActions>
    </Dialog>
  );
}
