import { Box, ButtonBase, Skeleton, Typography } from "@mui/material";
import type { ReactNode } from "react";
import type { Tone } from "./tone";
import { MONO } from "../../app/theme";

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

/**
 * A totals cell from the foot of the board: the label small and lettered, the figure large in mono.
 * Tone colours the figure only — a whole tile washed in red reads as an error state rather than a count.
 */
export default function KpiTile({ label, value, hint, tone = "neutral", loading, onClick, active }: Props) {
  const content = (
    <Box sx={{ minWidth: 0, width: "100%", textAlign: "left" }}>
      <Typography variant="subtitle2" sx={{ color: "text.secondary", display: "block", lineHeight: 1.3 }}>
        {label}
      </Typography>
      {loading ? (
        <Skeleton width={52} height={30} />
      ) : (
        <Typography
          component="div"
          sx={(t) => ({
            fontFamily: MONO,
            fontSize: 24,
            fontWeight: 700,
            lineHeight: 1.2,
            mt: 0.5,
            fontVariantNumeric: "tabular-nums",
            color: tone === "neutral" ? t.palette.text.primary : t.palette[tone].main,
          })}
        >
          {value}
        </Typography>
      )}
      {hint && (
        <Typography component="div" sx={{ fontSize: 11.5, color: "text.secondary", lineHeight: 1.35, mt: 0.4 }}>
          {hint}
        </Typography>
      )}
    </Box>
  );

  const baseSx = {
    p: 1.75,
    bgcolor: "board.cell",
    width: "100%",
    minHeight: 84,
    display: "flex",
    alignItems: "flex-start",
    boxShadow: active ? (t: { palette: { board: { amber: string } } }) => `inset 3px 0 0 ${t.palette.board.amber}` : "none",
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
