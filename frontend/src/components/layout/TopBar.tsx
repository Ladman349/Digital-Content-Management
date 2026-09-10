import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { navigationItems, pageTitleFor } from "../../constants/navigation";
import { useThemeMode } from "../../app/ThemeModeProvider";
import { API_ROOT, checkApiReady } from "../../api/client";
import { useNow } from "../../hooks/useNow";
import { MONO } from "../../app/theme";
import StatusDot from "../ui/StatusDot";

interface Props {
  onOpenSearch: () => void;
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** Board clock: the time and date the whole page is read against, in the viewer's own timezone. */
function Clock() {
  const now = useNow(30_000);
  const d = new Date(now);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone?.split("/").pop()?.replace(/_/g, " ") ?? "";
  return (
    <Box sx={{ textAlign: "right", display: { xs: "none", sm: "block" }, lineHeight: 1.1 }}>
      <Typography
        component="div"
        sx={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, letterSpacing: "0.06em", fontVariantNumeric: "tabular-nums" }}
      >
        {d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })}
      </Typography>
      <Typography
        component="div"
        sx={{ fontSize: 9.5, letterSpacing: "0.18em", textTransform: "uppercase", color: "text.secondary", whiteSpace: "nowrap" }}
      >
        {d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
        {zone ? ` · ${zone}` : ""}
      </Typography>
    </Box>
  );
}

/** Horizontal tab strip. Scrolls sideways on narrow screens rather than collapsing into a menu. */
function Tabs() {
  return (
    <Box
      component="nav"
      aria-label="Main"
      sx={{
        display: "flex",
        gap: 0.75,
        minWidth: 0,
        overflowX: "auto",
        scrollbarWidth: "none",
        "&::-webkit-scrollbar": { display: "none" },
      }}
    >
      {navigationItems.map((item) => (
        <Box
          key={item.path}
          component={NavLink}
          to={item.path}
          end={item.path === "/"}
          sx={(t) => ({
            flex: "none",
            px: 1.4,
            py: 0.7,
            borderRadius: 0.5,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.13em",
            textTransform: "uppercase",
            textDecoration: "none",
            color: "text.secondary",
            whiteSpace: "nowrap",
            "&:hover": { color: "text.primary", backgroundColor: t.palette.surface.hover },
            "&.active": { backgroundColor: t.palette.board.amber, color: t.palette.board.amberInk },
          })}
        >
          {item.title}
        </Box>
      ))}
    </Box>
  );
}

export default function TopBar({ onOpenSearch }: Props) {
  const location = useLocation();
  const { mode, toggle } = useThemeMode();
  const qc = useQueryClient();
  const fetching = useIsFetching();
  const [apiUp, setApiUp] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    const probe = async () => {
      const ok = await checkApiReady();
      if (alive) setApiUp(ok);
    };
    probe();
    const id = window.setInterval(probe, 30_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  return (
    <Box
      component="header"
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        bgcolor: "background.default",
        borderBottom: 2,
        borderColor: (t) => (t.palette.mode === "dark" ? "#1E1E21" : "surface.borderStrong"),
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, px: { xs: 2, md: 3.25 }, pt: 2, pb: { xs: 1.25, md: 1.75 } }}>
        <Typography variant="h1" component="h1" sx={{ color: "primary.main", whiteSpace: "nowrap" }}>
          {pageTitleFor(location.pathname)}
        </Typography>

        {/* Desktop: tabs sit beside the title. */}
        <Box sx={{ display: { xs: "none", md: "flex" }, minWidth: 0, ml: 1 }}>
          <Tabs />
        </Box>

        <Box sx={{ flex: 1, minWidth: 8 }} />

        <Clock />

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
          <Tooltip title={`Search everything · ${isMac ? "⌘K" : "Ctrl K"}`}>
            <IconButton onClick={onOpenSearch} aria-label="Search everything">
              <SearchRoundedIcon sx={{ fontSize: 19 }} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Refresh all data">
            <IconButton onClick={() => qc.invalidateQueries()} aria-label="Refresh all data">
              <RefreshRoundedIcon
                sx={{
                  fontSize: 19,
                  animation: fetching ? "sig-spin 0.9s linear infinite" : "none",
                  "@keyframes sig-spin": { to: { transform: "rotate(360deg)" } },
                }}
              />
            </IconButton>
          </Tooltip>

          <Tooltip title={mode === "light" ? "Switch to dark" : "Switch to light"}>
            <IconButton onClick={toggle} aria-label="Toggle theme">
              {mode === "light" ? <DarkModeRoundedIcon sx={{ fontSize: 19 }} /> : <LightModeRoundedIcon sx={{ fontSize: 19 }} />}
            </IconButton>
          </Tooltip>

          <Tooltip title={apiUp === null ? `Checking ${API_ROOT}` : apiUp ? `API reachable · ${API_ROOT}` : `API unreachable · ${API_ROOT}`}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, pl: 0.75 }}>
              <StatusDot tone={apiUp === null ? "neutral" : apiUp ? "success" : "error"} pulse={apiUp === true} />
              <Typography
                sx={{ display: { xs: "none", lg: "inline" }, fontSize: 10, fontWeight: 700, letterSpacing: "0.11em", textTransform: "uppercase", color: "text.secondary" }}
              >
                {apiUp === null ? "API" : apiUp ? "API online" : "API offline"}
              </Typography>
            </Box>
          </Tooltip>
        </Box>
      </Box>

      {/* Mobile: tabs get their own scrolling row. */}
      <Box sx={{ display: { xs: "block", md: "none" }, px: 2, pb: 1.25 }}>
        <Tabs />
      </Box>
    </Box>
  );
}
