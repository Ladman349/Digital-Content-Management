import { Box, Skeleton, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import type { SvgIconComponent } from "@mui/icons-material";

import FormatListBulletedRoundedIcon from "@mui/icons-material/FormatListBulletedRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import EditNoteRoundedIcon from "@mui/icons-material/EditNoteRounded";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";

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
  published: number;
  draft: number;
  archived: number;
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
            <Box component="span" sx={{ color: "#10B981", ml: 0.5 }}>
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

export default function PlaylistStatsRow({
  total,
  published,
  draft,
  archived,
  loading = false,
  onStatClick,
}: Props) {
  const stats: StatItem[] = [
    {
      title: "Total Playlists",
      value: total,
      icon: FormatListBulletedRoundedIcon,
      color: "#3B82F6",
      subtitle: "All sequences",
      filterValue: "All",
    },
    {
      title: "Published",
      value: published,
      icon: CheckCircleOutlineRoundedIcon,
      color: "#10B981",
      subtitle: "Active on devices",
      filterValue: "Published",
    },
    {
      title: "Drafts",
      value: draft,
      icon: EditNoteRoundedIcon,
      color: "#F59E0B",
      subtitle: "Work in progress",
      filterValue: "Draft",
    },
    {
      title: "Archived",
      value: archived,
      icon: Inventory2OutlinedIcon,
      color: "#64748B",
      subtitle: "Past sequences",
      filterValue: "Archived",
    },
  ];

  return (
    <Grid container spacing={3} sx={{ mb: 3 }}>
      {stats.map((stat) => (
        <Grid key={stat.title} size={{ xs: 12, sm: 6, lg: 3 }}>
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
