import { Box, ButtonBase, Skeleton, Typography } from "@mui/material";
import type { ReactNode } from "react";
import type { Tone } from "./tone";

interface Props {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  loading?: boolean;
  onClick?: () => void;
  active?: boolean;
}

/** Small, dense stat tile. Clickable tiles act as filters/links. */
export default function KpiTile({ label, value, hint, tone = "neutral", icon, loading, onClick, active }: Props) {
  const content = (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, width: "100%", textAlign: "left" }}>
      {icon && (
        <Box
          sx={(theme) => ({
            width: 34,
            height: 34,
            borderRadius: 1.5,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            color: tone === "neutral" ? theme.palette.text.secondary : theme.palette[tone].main,
            bgcolor: tone === "neutral" ? theme.palette.surface.hover : `${theme.palette[tone].main}1A`,
          })}
        >
          {icon}
        </Box>
      )}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: "block", lineHeight: 1.2 }}>
          {label}
        </Typography>
        {loading ? (
          <Skeleton width={56} height={26} />
        ) : (
          <Typography sx={{ fontSize: 20, fontWeight: 700, lineHeight: 1.25, fontVariantNumeric: "tabular-nums" }}>{value}</Typography>
        )}
        {hint && (
          <Typography variant="caption" color="text.secondary" component="div" sx={{ lineHeight: 1.3, mt: 0.25 }}>
            {hint}
          </Typography>
        )}
      </Box>
    </Box>
  );

  const baseSx = {
    p: 1.5,
    borderRadius: 2,
    border: 1,
    borderColor: active ? "primary.main" : "surface.border",
    bgcolor: "background.paper",
    width: "100%",
    minHeight: 68,
    transition: "border-color .15s, background-color .15s",
  } as const;

  if (onClick) {
    return (
      <ButtonBase onClick={onClick} sx={{ ...baseSx, justifyContent: "flex-start", "&:hover": { bgcolor: "surface.hover" } }}>
        {content}
      </ButtonBase>
    );
  }
  return <Box sx={baseSx}>{content}</Box>;
}
