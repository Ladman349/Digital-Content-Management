import { Chip } from "@mui/material";
import type { ChipProps } from "@mui/material";
import { Box } from "@mui/material";

export type StatusVariant = "online" | "offline" | "idle";

const STATUS_CONFIG: Record<
  StatusVariant,
  { label: string; dotColor: string; bg: string; text: string; border: string }
> = {
  online: {
    label: "Online",
    dotColor: "#22C55E",
    bg: "#F0FDF4",
    text: "#15803D",
    border: "#BBF7D0",
  },
  offline: {
    label: "Offline",
    dotColor: "#EF4444",
    bg: "#FEF2F2",
    text: "#B91C1C",
    border: "#FECACA",
  },
  idle: {
    label: "Idle",
    dotColor: "#F59E0B",
    bg: "#FFFBEB",
    text: "#B45309",
    border: "#FDE68A",
  },
};

interface Props {
  status: StatusVariant;
  size?: ChipProps["size"];
}

export default function StatusChip({ status, size = "small" }: Props) {
  const config = STATUS_CONFIG[status];

  return (
    <Chip
      label={
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Box
            component="span"
            sx={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              bgcolor: config.dotColor,
              boxShadow: `0 0 0 2px ${config.dotColor}33`,
              animation: status === "online" ? "pulse 2s ease-in-out infinite" : "none",
              "@keyframes pulse": {
                "0%, 100%": { opacity: 1 },
                "50%": { opacity: 0.5 },
              },
            }}
          />
          {config.label}
        </Box>
      }
      size={size}
      sx={{
        fontWeight: 600,
        fontSize: 12,
        borderRadius: "999px",
        bgcolor: config.bg,
        color: config.text,
        border: `1px solid ${config.border}`,
        height: size === "small" ? 26 : 32,
        "& .MuiChip-label": { px: 1.25 },
      }}
    />
  );
}

export function statusToVariant(status: string): StatusVariant {
  const normalized = status.toLowerCase();
  if (normalized === "online") return "online";
  if (normalized === "idle") return "idle";
  return "offline";
}
