import { BrowserRouter, Routes, Route } from "react-router-dom";

import MainLayout from "../components/layout/MainLayout";

import DashboardPage from "../pages/Dashboard/DashboardPage";
import DevicesPage from "../pages/Devices/DevicesPage";
import MediaPage from "../pages/Media/MediaPage";
import PlaylistsPage from "../pages/Playlists/PlaylistsPage";
import SchedulePage from "../pages/Schedule/SchedulePage";
import LoginPage from "../pages/Login/LoginPage";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<MainLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/devices" element={<DevicesPage />} />
          <Route path="/media" element={<MediaPage />} />
          <Route path="/playlists" element={<PlaylistsPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}