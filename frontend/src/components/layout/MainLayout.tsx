import { useState, useEffect } from "react";
import { Box, useTheme, useMediaQuery } from "@mui/material";
import { Outlet } from "react-router-dom";

import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

export default function MainLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  const handleToggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleCloseSidebar = () => {
    setSidebarOpen(false);
  };

  const handleSidebarItemClick = () => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#f5f7fb" }}>
      <Sidebar
        open={sidebarOpen}
        variant={isMobile ? "temporary" : "permanent"}
        onClose={handleCloseSidebar}
        onItemClick={handleSidebarItemClick}
      />

      <Box
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          background: "#F8FAFC",
          width: "100%",
          minWidth: 0,
        }}
      >
        <Navbar onToggleSidebar={handleToggleSidebar} />

        <Box
          component="main"
          sx={{
             mt: 3,
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}