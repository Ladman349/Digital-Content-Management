import { Box } from "@mui/material";
import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import TopBar from "./TopBar";
import CommandPalette from "./CommandPalette";

/**
 * The board runs full width with navigation across the top — there is no sidebar to steal room from
 * rows that are meant to be read at a distance.
 */
export default function AppShell() {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", display: "flex", flexDirection: "column" }}>
      <TopBar onOpenSearch={() => setSearchOpen(true)} />
      <Box component="main" sx={{ flex: 1, px: { xs: 2, md: 3.25 }, py: { xs: 1.5, md: 2 }, minWidth: 0 }}>
        <Outlet />
      </Box>
      {searchOpen && <CommandPalette onClose={() => setSearchOpen(false)} />}
    </Box>
  );
}
