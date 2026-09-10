import { Box, Tooltip } from "@mui/material";
import type { Tone } from "./tone";

export default function StatusDot({ tone, pulse = false, title, size = 8 }: { tone: Tone; pulse?: boolean; title?: string; size?: number }) {
  const dot = (
    <Box
      component="span"
      sx={(theme) => {
        const color = tone === "neutral" ? theme.palette.text.disabled : theme.palette[tone].main;
        return {
          display: "inline-block",
          width: size,
          height: size,
          borderRadius: "50%",
          bgcolor: color,
          flexShrink: 0,
          animation: pulse ? "sig-pulse 2s ease-in-out infinite" : "none",
          "@keyframes sig-pulse": { "0%,100%": { boxShadow: `0 0 0 0 ${color}55` }, "50%": { boxShadow: `0 0 0 4px ${color}11` } },
        };
      }}
    />
  );
  return title ? <Tooltip title={title}>{dot}</Tooltip> : dot;
}
