import { Box, Drawer, IconButton, Tooltip, Typography } from "@mui/material";
import { NavLink } from "react-router-dom";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import { navigationItems } from "../../constants/navigation";
import { useDevices, useSchedules } from "../../hooks/queries";
import { isScheduleLiveNow } from "../../utils/schedule";
import BrandMark from "./BrandMark";

export const SIDEBAR_WIDTH = 220;
export const SIDEBAR_COLLAPSED_WIDTH = 60;

interface Props {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function NavBadge({ value, tone }: { value: number; tone: "error" | "success" }) {
  if (!value) return null;
  return (
    <Box
      component="span"
      sx={(t) => ({
        ml: "auto",
        minWidth: 20,
        height: 20,
        px: 0.75,
        borderRadius: 10,
        fontSize: 11,
        fontWeight: 700,
        display: "grid",
        placeItems: "center",
        color: t.palette[tone].main,
        bgcolor: `${t.palette[tone].main}1F`,
        fontVariantNumeric: "tabular-nums",
      })}
    >
      {value}
    </Box>
  );
}

function NavList({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { data: devices = [] } = useDevices();
  const { data: schedules = [] } = useSchedules();
  const offline = devices.filter((d) => d.status === "Offline").length;
  const liveNow = schedules.filter((s) => isScheduleLiveNow(s)).length;

  return (
    <Box component="nav" aria-label="Main" sx={{ display: "flex", flexDirection: "column", gap: 0.25, px: 1 }}>
      {navigationItems.map((item) => {
        const Icon = item.icon;
        const badge = item.path === "/devices" ? <NavBadge value={offline} tone="error" /> : item.path === "/schedule" ? <NavBadge value={liveNow} tone="success" /> : null;
        const link = (
          <Box
            key={item.path}
            component={NavLink}
            to={item.path}
            end={item.path === "/"}
            onClick={onNavigate}
            sx={(t) => ({
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              height: 36,
              px: collapsed ? 0 : 1.25,
              justifyContent: collapsed ? "center" : "flex-start",
              borderRadius: 1.5,
              color: "text.secondary",
              textDecoration: "none",
              fontSize: 13.5,
              fontWeight: 600,
              position: "relative",
              "&:hover": { bgcolor: "surface.hover", color: "text.primary" },
              "&.active": {
                color: "primary.main",
                bgcolor: `${t.palette.primary.main}14`,
              },
              "& svg": { fontSize: 20 },
            })}
          >
            <Icon />
            {!collapsed && <span>{item.title}</span>}
            {!collapsed && badge}
            {collapsed && badge && <Box sx={{ position: "absolute", top: 4, right: 6, "& > span": { minWidth: 16, height: 16, fontSize: 10, px: 0.5 } }}>{badge}</Box>}
          </Box>
        );
        return collapsed ? (
          <Tooltip key={item.path} title={item.title} placement="right">
            {link}
          </Tooltip>
        ) : (
          link
        );
      })}
    </Box>
  );
}

export default function Sidebar({ collapsed, onToggleCollapsed, mobileOpen, onMobileClose }: Props) {
  const width = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  const content = (isMobile: boolean) => (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box sx={{ height: 52, display: "flex", alignItems: "center", px: collapsed && !isMobile ? 0 : 1.75, justifyContent: collapsed && !isMobile ? "center" : "flex-start", gap: 1.25 }}>
        <BrandMark size={26} />
        {(!collapsed || isMobile) && (
          <Typography sx={{ fontWeight: 700, fontSize: 14.5, letterSpacing: "-0.01em" }}>Signage</Typography>
        )}
      </Box>
      <Box sx={{ mt: 0.5 }}>
        <NavList collapsed={collapsed && !isMobile} onNavigate={isMobile ? onMobileClose : undefined} />
      </Box>
      <Box sx={{ flex: 1 }} />
      {!isMobile && (
        <Box sx={{ p: 1, display: "flex", justifyContent: collapsed ? "center" : "flex-end" }}>
          <Tooltip title={collapsed ? "Expand sidebar" : "Collapse sidebar"} placement="right">
            <IconButton onClick={onToggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
              {collapsed ? <ChevronRightRoundedIcon fontSize="small" /> : <ChevronLeftRoundedIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  );

  return (
    <>
      {/* Desktop */}
      <Box
        component="aside"
        sx={{
          display: { xs: "none", md: "block" },
          width,
          flexShrink: 0,
          borderRight: 1,
          borderColor: "surface.border",
          bgcolor: "background.paper",
          position: "sticky",
          top: 0,
          height: "100vh",
          transition: "width .15s ease",
        }}
      >
        {content(false)}
      </Box>
      {/* Mobile */}
      <Drawer open={mobileOpen} onClose={onMobileClose} sx={{ display: { md: "none" } }} slotProps={{ paper: { sx: { width: SIDEBAR_WIDTH } } }}>
        {content(true)}
      </Drawer>
    </>
  );
}
