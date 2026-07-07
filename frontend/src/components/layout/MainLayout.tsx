import { useState } from "react";
import { Box } from "@mui/material";
import { Outlet } from "react-router-dom";

import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#f5f7fb" }}>
      <Sidebar open={sidebarOpen} />

      <Box
        sx={{
          flexGrow: 1,
          p: 3,
          background: "#F8FAFC",
        }}
      >
        <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

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