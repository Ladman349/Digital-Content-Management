import { Box, Divider, Drawer, IconButton, Tooltip, Typography, useMediaQuery, useTheme } from "@mui/material";
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
  width?: number;
  onPrev?: () => void;
  onNext?: () => void;
  position?: string;
}

/**
 * Inspector panel docked to the right of a list. On desktop it sits beside the table (which stays clickable, so you
 * can move between records without closing anything); on small screens it becomes a full-height drawer.
 * ↑/↓ step through records when the parent supplies onPrev/onNext; Esc closes.
 */
export default function DetailPanel({ open, onClose, title, subtitle, actions, children, width = 400, onPrev, onNext, position }: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

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
    <Box sx={{ px: 2, pt: 1.5, pb: 1.25, display: "flex", alignItems: "flex-start", gap: 1 }}>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography component="div" sx={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3, overflowWrap: "anywhere" }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography component="div" variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {subtitle}
          </Typography>
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
            <Typography variant="caption" color="text.secondary" sx={{ mx: 0.5, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
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

  const body = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {header}
      <Divider />
      <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>{children}</Box>
      {actions && (
        <>
          <Divider />
          <Box sx={{ p: 1.5, display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>{actions}</Box>
        </>
      )}
    </Box>
  );

  if (isMobile) {
    return (
      <Drawer anchor="right" open={open} onClose={onClose} slotProps={{ paper: { sx: { width: "min(100vw, 460px)" } } }}>
        {body}
      </Drawer>
    );
  }

  if (!open) return null;

  return (
    <Box
      sx={{
        width,
        flexShrink: 0,
        position: "sticky",
        top: 64,
        alignSelf: "flex-start",
        height: "calc(100vh - 80px)",
        border: 1,
        borderColor: "surface.border",
        borderRadius: 2,
        bgcolor: "background.paper",
        overflow: "hidden",
      }}
    >
      {body}
    </Box>
  );
}
