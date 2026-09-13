import { Box, Drawer, IconButton, Tooltip, Typography } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import KeyboardArrowUpRoundedIcon from "@mui/icons-material/KeyboardArrowUpRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import { useEffect, type ReactNode } from "react";
import { useIsCompact } from "../../hooks/useIsPhone";

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
 * between records with ↑/↓ never closes anything.
 *
 * Below `md` it becomes a bottom sheet: a grab bar, a header that stays put while the body scrolls,
 * and actions that fill the width so the primary one is under the thumb.
 */
export default function DetailPanel({ open, onClose, title, subtitle, actions, children, onPrev, onNext, position }: Props) {
  const isSheet = useIsCompact();

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (target?.getAttribute("contenteditable") === "true") return;
      if (document.querySelector('[role="dialog"]:not(.sig-sheet)')) return; // a modal is open; leave keys to it
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
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, px: { xs: 2, md: 2.5 }, pt: { xs: 1.25, md: 2 }, pb: 1.5 }}>
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
            <Typography variant="caption" color="text.secondary" sx={{ mx: 0.5, whiteSpace: "nowrap", display: { xs: "none", sm: "inline" } }}>
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
        gridTemplateColumns: { xs: "1fr", sm: "repeat(auto-fit, minmax(260px, 1fr))" },
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
        pb: { xs: "calc(12px + env(safe-area-inset-bottom))", md: 1.5 },
        display: { xs: "grid", md: "flex" },
        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
        gap: 1,
        flexWrap: "wrap",
        borderTop: 1,
        borderColor: "surface.border",
        bgcolor: "board.bench",
      }}
    >
      {actions}
    </Box>
  );

  if (isSheet) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={onClose}
        slotProps={{
          paper: {
            className: "sig-sheet",
            sx: { maxHeight: "92dvh", borderTop: 2, borderColor: "board.amber", display: "flex", flexDirection: "column" },
          },
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "center", pt: 1, flexShrink: 0 }} aria-hidden>
          <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: "surface.borderStrong" }} />
        </Box>
        <Box sx={{ overflowY: "auto", flex: 1, minHeight: 0, overscrollBehavior: "contain" }}>
          <Box sx={{ position: "sticky", top: 0, zIndex: 1, bgcolor: "board.bench" }}>{header}</Box>
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
