import { Box, Skeleton, Typography } from "@mui/material";
import type { SvgIconComponent } from "@mui/icons-material";

import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import LocationOnRoundedIcon from "@mui/icons-material/LocationOnRounded";
import SignalWifiOffRoundedIcon from "@mui/icons-material/SignalWifiOffRounded";
import TvRoundedIcon from "@mui/icons-material/TvRounded";

import AnimatedCounter from "../common/AnimatedCounter";
import DashboardCard from "../common/DashboardCard";
import type { StatusFilter } from "./types";

interface StatItem {
  title: string;
  value: number;
  icon: SvgIconComponent;
  color: string;
  subtitle: string;
  filterValue?: StatusFilter;
}

interface Props {
  total: number;
  online: number;
  offline: number;
  locations: number;
  loading?: boolean;
  onStatClick?: (filter: StatusFilter) => void;
}

function StatCardContent({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
  filterValue,
  onStatClick,
  loading,
}: StatItem & { onStatClick?: (filter: StatusFilter) => void; loading?: boolean }) {
  const clickable = !!filterValue && !!onStatClick;

  return (
    <DashboardCard sx={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
      <Box
        onClick={clickable ? () => onStatClick(filterValue!) : undefined}
        sx={{
          cursor: clickable ? "pointer" : "default",
          "&:active": clickable ? { transform: "scale(0.98)" } : {},
        }}
      >
        <Box
          sx={{
            width: { xs: 38, sm: 44 },
            height: { xs: 38, sm: 44 },
            borderRadius: { xs: "10px", sm: "12px" },
            background: color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            mb: { xs: 1.25, sm: 1.75 },
            boxShadow: `0 4px 14px ${color}30`,
          }}
        >
          <Icon sx={{ fontSize: { xs: 19, sm: 22 } }} />
        </Box>

        <Typography sx={{ color: "#64748B", fontSize: { xs: 11.5, sm: 13 }, fontWeight: 600 }}>
          {title}
        </Typography>

        <AnimatedCounter value={value} loading={loading} />

        <Typography sx={{ color: "#94A3B8", fontSize: { xs: 11, sm: 12 }, mt: { xs: 0.5, sm: 1 }, fontWeight: 500 }}>
          {subtitle}
          {clickable && (
            <Box component="span" sx={{ color: "#6C4CF1", ml: 0.5, fontWeight: 600 }}>
              · Filter
            </Box>
          )}
        </Typography>
      </Box>
    </DashboardCard>
  );
}

function StatCardSkeleton() {
  return (
    <DashboardCard>
      <Skeleton variant="rounded" width={40} height={40} sx={{ borderRadius: "12px", mb: 1.5 }} />
      <Skeleton width="60%" height={16} />
      <Skeleton width="40%" height={32} sx={{ mt: 0.5 }} />
      <Skeleton width="50%" height={14} sx={{ mt: 0.5 }} />
    </DashboardCard>
  );
}

export default function DeviceStatsRow({
  total,
  online,
  offline,
  locations,
  loading = false,
  onStatClick,
}: Props) {
  const stats: StatItem[] = [
    {
      title: "Total Devices",
      value: total,
      icon: TvRoundedIcon,
      color: "#6C4CF1",
      subtitle: "Registered displays",
      filterValue: "All",
    },
    {
      title: "Online",
      value: online,
      icon: CheckCircleRoundedIcon,
      color: "#10B981",
      subtitle: "Active right now",
      filterValue: "Online",
    },
    {
      title: "Offline",
      value: offline,
      icon: SignalWifiOffRoundedIcon,
      color: "#EF4444",
      subtitle: "Needs attention",
      filterValue: "Offline",
    },
    {
      title: "Locations",
      value: locations,
      icon: LocationOnRoundedIcon,
      color: "#0EA5E9",
      subtitle: "Unique sites",
    },
  ];

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "repeat(2, 1fr)",
          sm: "repeat(2, 1fr)",
          lg: "repeat(4, 1fr)",
        },
        gap: { xs: 1.5, sm: 2, md: 3 },
        mb: { xs: 2.5, sm: 3.5 },
      }}
    >
      {stats.map((stat) => (
        <Box key={stat.title}>
          {loading ? (
            <StatCardSkeleton />
          ) : (
            <StatCardContent {...stat} onStatClick={onStatClick} loading={loading} />
          )}
        </Box>
      ))}
    </Box>
  );
}
