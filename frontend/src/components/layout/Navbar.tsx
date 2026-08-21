import {
  AppBar,
  Typography,
  Box,
  Avatar,
  IconButton,
  Paper,
  Menu,
  MenuItem,
  ListItemIcon,
  Badge,
} from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import FiberManualRecordRoundedIcon from "@mui/icons-material/FiberManualRecordRounded";

import SearchBar from "./SearchBar";

export default function Navbar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const navigate = useNavigate();
  
  const [notifAnchorEl, setNotifAnchorEl] = useState<null | HTMLElement>(null);
  const [profileAnchorEl, setProfileAnchorEl] = useState<null | HTMLElement>(null);

  const handleNotifOpen = (event: React.MouseEvent<HTMLElement>) => {
    setNotifAnchorEl(event.currentTarget);
  };

  const handleNotifClose = () => {
    setNotifAnchorEl(null);
  };

  const handleProfileOpen = (event: React.MouseEvent<HTMLElement>) => {
    setProfileAnchorEl(event.currentTarget);
  };

  const handleProfileClose = () => {
    setProfileAnchorEl(null);
  };

  const handleLogout = () => {
    handleProfileClose();
    navigate("/login");
  };

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: "transparent",
        zIndex: 1100,
        maxWidth: "1600px",
        mx: "auto",
        width: "100%",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          height: { xs: 58, sm: 68 },
          display: "flex",
          alignItems: "center",
          px: { xs: 1.5, sm: 2.5 },
          borderRadius: { xs: 3.5, sm: 4 },
          border: "1px solid rgba(226, 232, 240, 0.8)",
          bgcolor: "rgba(255, 255, 255, 0.88)",
          backdropFilter: "blur(16px)",
          boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.05)",
        }}
      >
        <IconButton
          onClick={onToggleSidebar}
          size="small"
          aria-label="open drawer"
          sx={{
            p: { xs: 0.75, sm: 1 },
            mr: { xs: 1, sm: 1.5 },
            bgcolor: "#F8FAFC",
            border: "1px solid #E2E8F0",
            borderRadius: 2.5,
            "&:hover": { bgcolor: "#F1F5F9" },
          }}
        >
          <MenuRoundedIcon fontSize="small" sx={{ color: "#334155" }} />
        </IconButton>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: { xs: 15, sm: 18, md: 20 },
              letterSpacing: "-0.02em",
              color: "#0F172A",
              whiteSpace: "nowrap",
            }}
          >
            Signage CMS
          </Typography>
          <Box
            sx={{
              display: { xs: "none", sm: "flex" },
              alignItems: "center",
              gap: 0.5,
              bgcolor: "rgba(16, 185, 129, 0.1)",
              color: "#059669",
              px: 1,
              py: 0.25,
              borderRadius: "20px",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            <FiberManualRecordRoundedIcon sx={{ fontSize: 8, color: "#10B981" }} />
            LIVE
          </Box>
        </Box>

        <Box sx={{ flexGrow: 1 }} />

        <Box sx={{ display: { xs: "none", md: "block" }, mx: 2 }}>
          <SearchBar />
        </Box>

        <IconButton
          onClick={handleNotifOpen}
          size="small"
          sx={{
            p: 1,
            bgcolor: "#F8FAFC",
            border: "1px solid #E2E8F0",
            borderRadius: 2.5,
            "&:hover": { bgcolor: "#F1F5F9" },
          }}
        >
          <Badge variant="dot" color="primary">
            <NotificationsRoundedIcon fontSize="small" sx={{ color: "#475569" }} />
          </Badge>
        </IconButton>
        
        <Menu
          anchorEl={notifAnchorEl}
          open={Boolean(notifAnchorEl)}
          onClose={handleNotifClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{
            paper: {
              elevation: 0,
              sx: {
                mt: 1.5,
                minWidth: 220,
                boxShadow: "0 12px 32px rgba(15, 23, 42, 0.12)",
                border: "1px solid #E2E8F0",
                borderRadius: 3,
                p: 1,
              }
            }
          }}
        >
          <MenuItem disabled sx={{ py: 1.5, justifyContent: "center" }}>
            <Typography variant="body2" sx={{ color: "#94A3B8" }}>No unread notifications</Typography>
          </MenuItem>
        </Menu>

        <Box
          onClick={handleProfileOpen}
          sx={{
            display: "flex",
            alignItems: "center",
            ml: { xs: 1, sm: 1.5 },
            gap: 1,
            cursor: "pointer",
            p: 0.5,
            pr: { xs: 0.5, sm: 1.5 },
            borderRadius: 3,
            border: "1px solid transparent",
            transition: "all 0.2s ease",
            "&:hover": { bgcolor: "#F8FAFC", borderColor: "#E2E8F0" }
          }}
        >
          <Avatar
            sx={{
              width: { xs: 34, sm: 38 },
              height: { xs: 34, sm: 38 },
              bgcolor: "#6C4CF1",
              fontSize: 14,
              fontWeight: 700,
              boxShadow: "0 4px 12px rgba(108, 76, 241, 0.3)",
            }}
          >
            A
          </Avatar>

          <Box sx={{ display: { xs: "none", lg: "block" } }}>
            <Typography sx={{ fontWeight: 700, fontSize: 13, color: "#0F172A", lineHeight: 1.2 }}>
              Akash
            </Typography>
            <Typography sx={{ fontSize: 11, color: "#64748B", fontWeight: 500 }}>
              Administrator
            </Typography>
          </Box>

          <KeyboardArrowDownRoundedIcon fontSize="small" sx={{ display: { xs: "none", sm: "block" }, color: "#94A3B8" }} />
        </Box>

        <Menu
          anchorEl={profileAnchorEl}
          open={Boolean(profileAnchorEl)}
          onClose={handleProfileClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{
            paper: {
              elevation: 0,
              sx: {
                mt: 1.5,
                minWidth: 200,
                boxShadow: "0 12px 32px rgba(15, 23, 42, 0.12)",
                border: "1px solid #E2E8F0",
                borderRadius: 3,
                p: 0.5,
              }
            }
          }}
        >
          <MenuItem onClick={handleLogout} sx={{ color: "error.main", borderRadius: 2, py: 1 }}>
            <ListItemIcon><LogoutRoundedIcon fontSize="small" color="error" /></ListItemIcon>
            <Typography sx={{ fontWeight: 600, fontSize: 13 }}>Logout</Typography>
          </MenuItem>
        </Menu>
      </Paper>
    </AppBar>
  );
}