import { Box, ButtonBase, IconButton, Tooltip, Typography } from "@mui/material";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { pageTitleFor } from "../../constants/navigation";
import { useThemeMode } from "../../app/ThemeModeProvider";
import { API_ROOT, checkApiReady } from "../../api/client";
import StatusDot from "../ui/StatusDot";

interface Props {
  onOpenMenu: () => void;
  onOpenSearch: () => void;
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export default function TopBar({ onOpenMenu, onOpenSearch }: Props) {
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
        height: 52,
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: { xs: 1.5, md: 2.5 },
        bgcolor: "background.paper",
        borderBottom: 1,
        borderColor: "surface.border",
      }}
    >
      <IconButton onClick={onOpenMenu} sx={{ display: { md: "none" } }} aria-label="Open navigation">
        <MenuRoundedIcon />
      </IconButton>
      <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{pageTitleFor(location.pathname)}</Typography>

      <Box sx={{ flex: 1 }} />

      <ButtonBase
        onClick={onOpenSearch}
        aria-label="Search everything"
        sx={{
          height: 32,
          px: 1.25,
          gap: 1,
          borderRadius: 1.5,
          border: 1,
          borderColor: "surface.borderStrong",
          color: "text.secondary",
          fontSize: 13,
          minWidth: { xs: 0, sm: 220 },
          justifyContent: "flex-start",
          "&:hover": { bgcolor: "surface.hover" },
        }}
      >
        <SearchRoundedIcon sx={{ fontSize: 18 }} />
        <Box component="span" sx={{ display: { xs: "none", sm: "inline" }, flex: 1, textAlign: "left" }}>
          Search devices, media, playlists…
        </Box>
        <Box
          component="kbd"
          sx={{
            display: { xs: "none", sm: "inline" },
            fontFamily: "inherit",
            fontSize: 11,
            px: 0.6,
            py: 0.1,
            borderRadius: 0.75,
            border: 1,
            borderColor: "surface.borderStrong",
            color: "text.disabled",
          }}
        >
          {isMac ? "⌘K" : "Ctrl K"}
        </Box>
      </ButtonBase>

      <Tooltip title="Refresh all data">
        <IconButton onClick={() => qc.invalidateQueries()} aria-label="Refresh all data">
          <RefreshRoundedIcon
            sx={{
              fontSize: 20,
              animation: fetching ? "sig-spin 0.9s linear infinite" : "none",
              "@keyframes sig-spin": { to: { transform: "rotate(360deg)" } },
            }}
          />
        </IconButton>
      </Tooltip>

      <Tooltip title={mode === "light" ? "Switch to dark theme" : "Switch to light theme"}>
        <IconButton onClick={toggle} aria-label="Toggle theme">
          {mode === "light" ? <DarkModeRoundedIcon sx={{ fontSize: 20 }} /> : <LightModeRoundedIcon sx={{ fontSize: 20 }} />}
        </IconButton>
      </Tooltip>

      <Tooltip title={apiUp === null ? `Checking ${API_ROOT}` : apiUp ? `API reachable · ${API_ROOT}` : `API unreachable · ${API_ROOT}`}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, pl: 0.5 }}>
          <StatusDot tone={apiUp === null ? "neutral" : apiUp ? "success" : "error"} pulse={apiUp === true} />
          <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", lg: "inline" }, fontWeight: 600 }}>
            {apiUp === null ? "API" : apiUp ? "API online" : "API offline"}
          </Typography>
        </Box>
      </Tooltip>
    </Box>
  );
}
