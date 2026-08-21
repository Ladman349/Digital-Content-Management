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
    setSidebarOpen((prev) => !prev);
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
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#F8FAFC" }}>
      <Sidebar
        open={sidebarOpen}
        variant={isMobile ? "temporary" : "permanent"}
        onClose={handleCloseSidebar}
        onItemClick={handleSidebarItemClick}
      />

      <Box
        sx={{
          flexGrow: 1,
          p: { xs: 1.5, sm: 2.5, md: 3.5 },
          width: "100%",
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Navbar onToggleSidebar={handleToggleSidebar} />

        <Box
          component="main"
          sx={{
            mt: { xs: 2, sm: 2.5, md: 3 },
            flexGrow: 1,
            maxWidth: "1600px",
            width: "100%",
            mx: "auto",
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}