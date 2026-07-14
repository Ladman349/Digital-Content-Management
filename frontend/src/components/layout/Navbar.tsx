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
} from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";

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
        p: { xs: 1, sm: 2 },
      }}
    >
      <Paper
        elevation={0}
        sx={{
          height: { xs: 60, sm: 72 },
          display: "flex",
          alignItems: "center",
          px: { xs: 1.5, sm: 3 },
          borderRadius: 4,
          border: "1px solid #E5E7EB",
          boxShadow: "0 8px 30px rgba(0,0,0,.05)",
        }}
      >
        <IconButton onClick={onToggleSidebar} sx={{ mr: { xs: 0.5, sm: 2 } }}>
          <MenuRoundedIcon />
        </IconButton>

        <Typography
          sx={{
            ml: { xs: 1, sm: 3 },
            fontWeight: 800,
            fontSize: { xs: 16, sm: 20, md: 24 },
            whiteSpace: "nowrap",
          }}
        >
          Digital Signage CMS
        </Typography>

        <Box sx={{ flexGrow: 1 }} />

        <Box sx={{ display: { xs: "none", lg: "block" } }}>
          <SearchBar />
        </Box>

        <Box sx={{ width: { xs: 8, lg: 24 } }} />

        <IconButton onClick={handleNotifOpen}>
          <NotificationsRoundedIcon />
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
                minWidth: 200,
                boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                border: "1px solid #E5E7EB",
                borderRadius: 3,
              }
            }
          }}
        >
          <MenuItem disabled sx={{ py: 2, justifyContent: "center" }}>
            <Typography variant="body2">No notifications</Typography>
          </MenuItem>
        </Menu>

        <Box
          onClick={handleProfileOpen}
          sx={{
            display: "flex",
            alignItems: "center",
            ml: { xs: 1.5, sm: 3 },
            gap: 1.5,
            cursor: "pointer",
            p: 0.5,
            borderRadius: 2,
            "&:hover": { bgcolor: "#F8FAFC" }
          }}
        >
          <Avatar sx={{ bgcolor: "#6C4CF1" }}>A</Avatar>

          <Box sx={{ display: { xs: "none", md: "block" } }}>
            <Typography sx={{ fontWeight: 700 }}>Akash</Typography>
            <Typography sx={{ fontSize: 12, color: "#6B7280" }}>Administrator</Typography>
          </Box>

          <KeyboardArrowDownRoundedIcon sx={{ display: { xs: "none", md: "block" } }} />
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
                boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                border: "1px solid #E5E7EB",
                borderRadius: 3,
              }
            }
          }}
        >
          <MenuItem onClick={handleLogout} sx={{ color: "error.main" }}>
            <ListItemIcon><LogoutRoundedIcon fontSize="small" color="error" /></ListItemIcon>
            Logout
          </MenuItem>
        </Menu>
      </Paper>
    </AppBar>
  );
}