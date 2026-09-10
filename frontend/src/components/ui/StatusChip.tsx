import { Box, Typography } from "@mui/material";
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

/**
 * A flag, not a chip. On a board, status is a lit dot and a word — the enclosing pill adds a second
 * shape to parse and makes a column of them read as buttons.
 */
export default function StatusChip({ label, tone, dot = true, pulse }: { label: string; tone?: Tone; dot?: boolean; pulse?: boolean }) {
  const t = tone ?? TONE_FOR[label] ?? "neutral";
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.9, whiteSpace: "nowrap" }}>
      {dot && <StatusDot tone={t} pulse={pulse} size={7} />}
      <Typography
        component="span"
        sx={(theme) => ({
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.13em",
          textTransform: "uppercase",
          color: t === "neutral" ? theme.palette.text.disabled : theme.palette[t].main,
        })}
      >
        {label}
      </Typography>
    </Box>
  );
}
