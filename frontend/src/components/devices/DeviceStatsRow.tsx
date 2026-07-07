import { Box, Skeleton, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
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
    <DashboardCard>
      <Box
        onClick={clickable ? () => onStatClick(filterValue!) : undefined}
        sx={{
          cursor: clickable ? "pointer" : "default",
          "&:active": clickable ? { transform: "scale(0.99)" } : {},
        }}
      >
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: "14px",
            background: color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            mb: 2,
            boxShadow: `0 8px 20px ${color}35`,
          }}
        >
          <Icon sx={{ fontSize: 24 }} />
        </Box>

        <Typography sx={{ color: "#64748B", fontSize: 13, fontWeight: 500 }}>
          {title}
        </Typography>

        <AnimatedCounter value={value} loading={loading} />

        <Typography sx={{ color: "#94A3B8", fontSize: 12, mt: 1, fontWeight: 500 }}>
          {subtitle}
          {clickable && (
            <Box component="span" sx={{ color: "#6C4CF1", ml: 0.5 }}>
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
      <Skeleton variant="rounded" width={48} height={48} sx={{ borderRadius: "14px", mb: 2 }} />
      <Skeleton width="60%" height={16} />
      <Skeleton width="40%" height={36} sx={{ mt: 1 }} />
      <Skeleton width="50%" height={14} sx={{ mt: 1 }} />
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
      color: "#22C55E",
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
      color: "#3B82F6",
      subtitle: "Unique sites",
    },
  ];

  return (
    <Grid container spacing={3} sx={{ mb: 3 }}>
      {stats.map((stat) => (
        <Grid key={stat.title} sx={{ width: { xs: "100%", sm: "48%", lg: "24%" } }}>
          {loading ? (
            <StatCardSkeleton />
          ) : (
            <StatCardContent {...stat} onStatClick={onStatClick} loading={loading} />
          )}
        </Grid>
      ))}
    </Grid>
  );
}
