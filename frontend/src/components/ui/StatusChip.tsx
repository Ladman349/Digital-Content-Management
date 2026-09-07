import { Chip, alpha } from "@mui/material";
import type { Tone } from "./tone";
import StatusDot from "./StatusDot";

const TONE_FOR: Record<string, Tone> = {
  Online: "success",
  Idle: "warning",
  Offline: "error",
  Published: "success",
  Draft: "warning",
  Archived: "neutral",
  Active: "success",
  Paused: "neutral",
  Expired: "error",
  Emergency: "error",
  High: "warning",
  Normal: "info",
  Low: "neutral",
  Image: "info",
  Video: "primary",
};

export default function StatusChip({ label, tone, dot = true, pulse }: { label: string; tone?: Tone; dot?: boolean; pulse?: boolean }) {
  const t = tone ?? TONE_FOR[label] ?? "neutral";
  return (
    <Chip
      icon={dot ? <StatusDot tone={t} pulse={pulse} size={7} /> : undefined}
      label={label}
      sx={(theme) => {
        const color = t === "neutral" ? theme.palette.text.secondary : theme.palette[t].main;
        return {
          color,
          bgcolor: alpha(color, theme.palette.mode === "light" ? 0.1 : 0.18),
          border: `1px solid ${alpha(color, 0.25)}`,
          "& .MuiChip-icon": { ml: "7px", mr: "-3px" },
        };
      }}
    />
  );
}
