import { Box, Drawer, IconButton, Tooltip, Typography, useMediaQuery, useTheme } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import KeyboardArrowUpRoundedIcon from "@mui/icons-material/KeyboardArrowUpRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import { useEffect, type ReactNode } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** Retained for call-site compatibility; the bench always spans the board. */
  width?: number;
  onPrev?: () => void;
  onNext?: () => void;
  position?: string;
}

/**
 * The bench — the quiet second register beneath the board.
 *
 * A board this loud cannot also do dense work, so detail and editing sit on a lifted panel below the
 * rows: smaller type, mono figures, columns that flow. The board keeps its full width, and moving
 * between records with ↑/↓ never closes anything. On a phone it becomes a bottom sheet.
 */
export default function DetailPanel({ open, onClose, title, subtitle, actions, children, onPrev, onNext, position }: Props) {
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down("md"));

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (target?.getAttribute("contenteditable") === "true") return;
      if (document.querySelector('[role="dialog"]')) return; // a modal is open; leave keys to it
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown" && onNext) {
        e.preventDefault();
        onNext();
      }
      if (e.key === "ArrowUp" && onPrev) {
        e.preventDefault();
        onPrev();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, onNext, onPrev]);

  const header = (
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, px: { xs: 2, md: 2.5 }, pt: 2, pb: 1.5 }}>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          component="div"
          sx={{ fontSize: 17, fontWeight: 700, textTransform: "uppercase", letterSpacing: "-0.005em", lineHeight: 1.2, overflowWrap: "anywhere" }}
        >
          {title}
        </Typography>
        {subtitle && (
          <Box sx={{ mt: 0.5, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", color: "text.secondary", fontSize: 12 }}>
            {subtitle}
          </Box>
        )}
      </Box>
      {(onPrev || onNext) && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
          <Tooltip title="Previous (↑)">
            <span>
              <IconButton onClick={onPrev} disabled={!onPrev} aria-label="Previous record">
                <KeyboardArrowUpRoundedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Next (↓)">
            <span>
              <IconButton onClick={onNext} disabled={!onNext} aria-label="Next record">
                <KeyboardArrowDownRoundedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          {position && (
            <Typography variant="caption" color="text.secondary" sx={{ mx: 0.5, whiteSpace: "nowrap" }}>
              {position}
            </Typography>
          )}
        </Box>
      )}
      <IconButton onClick={onClose} aria-label="Close panel">
        <CloseRoundedIcon fontSize="small" />
      </IconButton>
    </Box>
  );

  /** Sections flow into columns, so the bench fills its width instead of running as one long strip. */
  const content = (
    <Box
      sx={{
        px: { xs: 2, md: 2.5 },
        pb: 2.5,
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "repeat(auto-fit, minmax(260px, 1fr))" },
        gap: { xs: 2, md: 3.5 },
        alignItems: "start",
      }}
    >
      {children}
    </Box>
  );

  const footer = actions && (
    <Box
      sx={{
        px: { xs: 2, md: 2.5 },
        py: 1.5,
        display: "flex",
        gap: 1,
        flexWrap: "wrap",
        borderTop: 1,
        borderColor: "surface.border",
      }}
    >
      {actions}
    </Box>
  );

  if (isPhone) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        slotProps={{ paper: { sx: { maxHeight: "88vh", borderTop: 2, borderColor: "board.amber" } } }}
      >
        <Box sx={{ overflowY: "auto" }}>
          {header}
          {content}
        </Box>
        {footer}
      </Drawer>
    );
  }

  if (!open) return null;

  return (
    <Box
      sx={(t) => ({
        mt: "2px",
        bgcolor: "board.bench",
        borderTop: `2px solid ${t.palette.board.amber}`,
      })}
    >
      {header}
      {content}
      {footer}
    </Box>
  );
}
