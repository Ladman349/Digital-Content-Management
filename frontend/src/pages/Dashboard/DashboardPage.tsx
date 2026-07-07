import Box from "@mui/material/Box";

import DashboardHeader from "../../components/dashboard/DashboardHeader";
import StatsGrid from "../../components/dashboard/StatsGrid";
import ActivityChart from "../../components/dashboard/ActivityChart";
import DeviceStatusCard from "../../components/dashboard/DeviceStatusCard";
import RecentDevices from "../../components/dashboard/RecentDevices";
import RecentPlaylists from "../../components/dashboard/RecentPlaylists";
import StorageCard from "../../components/dashboard/StorageCard";
import QuickActions from "../../components/dashboard/QuickActions";

export default function DashboardPage() {
  return (
    <>
      <DashboardHeader />

      <Box sx={{ mt: 4 }}>
        <StatsGrid />
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 3,
          mt: 3,

          gridTemplateColumns: {
            xs: "1fr",
            lg: "2fr 1fr",
          },
        }}
      >
        <ActivityChart />

        <DeviceStatusCard />
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 3,
          mt: 3,

          gridTemplateColumns: {
            xs: "1fr",
            md: "1fr 1fr",
          },
        }}
      >
        <RecentDevices />
        <RecentPlaylists />
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 3,
          mt: 3,

          gridTemplateColumns: {
            xs: "1fr",
            md: "1fr 1fr",
          },
        }}
      >
        <StorageCard />
        <QuickActions />
      </Box>
    </>
  );
}