import { Box, Checkbox, FormControlLabel, FormGroup, Typography } from "@mui/material";
import TvRoundedIcon from "@mui/icons-material/TvRounded";
import type { Device } from "../../types/device";

interface Props {
  devices: Device[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export default function DeviceSelector({ devices, value, onChange, disabled }: Props) {
  const handleToggle = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter(v => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  const handleToggleAll = () => {
    if (value.length === devices.length) {
      onChange([]);
    } else {
      onChange(devices.map(d => d.id));
    }
  };

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case "Online": return "🟢";
      case "Idle": return "🟡";
      case "Offline": return "🔴";
      default: return "⚪";
    }
  };

  const hasOfflineSelected = devices.some(d => value.includes(d.id) && d.status === "Offline");

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography sx={{ fontWeight: 600, fontSize: 14, color: "#1E293B", display: "flex", alignItems: "center", gap: 1 }}>
          <TvRoundedIcon sx={{ fontSize: 18, color: "#3B82F6" }} />
          Target Devices
        </Typography>
        <Typography
          onClick={disabled ? undefined : handleToggleAll}
          sx={{ fontSize: 13, color: "#3B82F6", cursor: disabled ? "default" : "pointer", fontWeight: 600 }}
        >
          {value.length === devices.length ? "Deselect All" : "Select All"}
        </Typography>
      </Box>

      <Box sx={{ p: 2, border: "1px solid #E2E8F0", borderRadius: "12px", maxHeight: 200, overflowY: "auto", bgcolor: disabled ? "#F8FAFC" : "#fff" }}>
        <FormGroup>
          {devices.map(device => (
            <FormControlLabel
              key={device.id}
              control={
                <Checkbox
                  checked={value.includes(device.id)}
                  onChange={() => handleToggle(device.id)}
                  disabled={disabled}
                  size="small"
                />
              }
              label={
                <Typography sx={{ fontSize: 14 }}>
                  {getStatusIndicator(device.status)} {device.name} <Typography component="span" sx={{ fontSize: 12, color: "#64748B" }}>({device.status})</Typography>
                </Typography>
              }
            />
          ))}
        </FormGroup>
      </Box>
      {hasOfflineSelected && (
        <Typography sx={{ fontSize: 13, color: "#D97706", mt: 0.5, bgcolor: "#FEF3C7", p: 1, borderRadius: "8px" }}>
          One or more selected devices are currently offline. The schedule will be delivered automatically when they reconnect.
        </Typography>
      )}
    </Box>
  );
}
