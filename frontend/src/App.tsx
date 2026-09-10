import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Box, LinearProgress } from "@mui/material";
import AppShell from "./components/layout/AppShell";

// Route-level code splitting: the dashboard is the common entry point, and the heavier
// editors (playlist, schedule, upload) only load once their page is opened.
const DashboardPage = lazy(() => import("./pages/Dashboard/DashboardPage"));
const DevicesPage = lazy(() => import("./pages/Devices/DevicesPage"));
const MediaPage = lazy(() => import("./pages/Media/MediaPage"));
const PlaylistsPage = lazy(() => import("./pages/Playlists/PlaylistsPage"));
const SchedulePage = lazy(() => import("./pages/Schedule/SchedulePage"));
const UpdatesPage = lazy(() => import("./pages/Updates/UpdatesPage"));

function RouteFallback() {
  return (
    <Box sx={{ pt: 0.5 }} aria-busy="true" aria-live="polite">
      <LinearProgress />
    </Box>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route
            path="/"
            element={
              <Suspense fallback={<RouteFallback />}>
                <DashboardPage />
              </Suspense>
            }
          />
          <Route
            path="/devices"
            element={
              <Suspense fallback={<RouteFallback />}>
                <DevicesPage />
              </Suspense>
            }
          />
          <Route
            path="/media"
            element={
              <Suspense fallback={<RouteFallback />}>
                <MediaPage />
              </Suspense>
            }
          />
          <Route
            path="/playlists"
            element={
              <Suspense fallback={<RouteFallback />}>
                <PlaylistsPage />
              </Suspense>
            }
          />
          <Route
            path="/schedule"
            element={
              <Suspense fallback={<RouteFallback />}>
                <SchedulePage />
              </Suspense>
            }
          />
          <Route
            path="/updates"
            element={
              <Suspense fallback={<RouteFallback />}>
                <UpdatesPage />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
