import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Box, LinearProgress } from "@mui/material";
import AppShell from "./components/layout/AppShell";
import { useAuth } from "./auth/AuthProvider";
import LoginPage from "./pages/Login/LoginPage";

// Route-level code splitting: the dashboard is the common entry point, and the heavier
// editors (playlist, schedule, upload) only load once their page is opened.
const DashboardPage = lazy(() => import("./pages/Dashboard/DashboardPage"));
const DevicesPage = lazy(() => import("./pages/Devices/DevicesPage"));
const MediaPage = lazy(() => import("./pages/Media/MediaPage"));
const PlaylistsPage = lazy(() => import("./pages/Playlists/PlaylistsPage"));
const SchedulePage = lazy(() => import("./pages/Schedule/SchedulePage"));
const UpdatesPage = lazy(() => import("./pages/Updates/UpdatesPage"));
const AccountsPage = lazy(() => import("./pages/Accounts/AccountsPage"));

function RouteFallback() {
  return (
    <Box sx={{ pt: 0.5 }} aria-busy="true" aria-live="polite">
      <LinearProgress />
    </Box>
  );
}

function Page({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

/** Player updates and accounts belong to the operator; a client user typing the URL lands on Now. */
function AdminOnly({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  return isAdmin ? <Page>{children}</Page> : <Navigate to="/" replace />;
}

export default function App() {
  const { status, retry } = useAuth();

  if (status === "loading") {
    return (
      <Box sx={{ minHeight: "100dvh", bgcolor: "background.default" }} aria-busy="true" aria-live="polite">
        <LinearProgress />
      </Box>
    );
  }
  if (status === "unreachable") return <LoginPage unreachable onRetry={retry} />;
  if (status === "signedOut") return <LoginPage />;

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Page><DashboardPage /></Page>} />
          <Route path="/devices" element={<Page><DevicesPage /></Page>} />
          <Route path="/media" element={<Page><MediaPage /></Page>} />
          <Route path="/playlists" element={<Page><PlaylistsPage /></Page>} />
          <Route path="/schedule" element={<Page><SchedulePage /></Page>} />
          <Route path="/updates" element={<AdminOnly><UpdatesPage /></AdminOnly>} />
          <Route path="/accounts" element={<AdminOnly><AccountsPage /></AdminOnly>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
