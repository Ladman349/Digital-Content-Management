import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { MONO } from "../../app/theme";

interface Props {
  /** The thing being named: a screen, a file, a playlist, a release. */
  name: ReactNode;
  /** Its identifier and any qualifier — kept in mono so it reads as machine data, not prose. */
  sub?: ReactNode;
  /** Something small ahead of the name: a thumbnail, a departure time. */
  before?: ReactNode;
  size?: "board" | "compact";
  muted?: boolean;
  title?: string;
}

/**
 * The left-hand cell of every board row. Names are set large and uppercase so a list can be read at a
 * distance; the identifier sits under it in mono at a size that only matters once you are close.
 */
export default function RowLead({ name, sub, before, size = "board", muted, title }: Props) {
  const big = size === "board";
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
      {before}
      <Box sx={{ minWidth: 0 }}>
        <Typography
          component="div"
          title={title}
          sx={{
            fontSize: big ? { xs: 15, md: 20 } : 14,
            fontWeight: 700,
            letterSpacing: "-0.005em",
            lineHeight: 1.15,
            textTransform: "uppercase",
            color: muted ? "text.disabled" : "text.primary",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </Typography>
        {sub && (
          <Typography
            component="div"
            sx={{
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: "0.08em",
              color: "text.secondary",
              mt: 0.45,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {sub}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
