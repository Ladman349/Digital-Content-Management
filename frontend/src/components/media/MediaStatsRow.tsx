import { Box, Skeleton, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import type { SvgIconComponent } from "@mui/icons-material";

import InsertDriveFileRoundedIcon from "@mui/icons-material/InsertDriveFileRounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import MovieRoundedIcon from "@mui/icons-material/MovieRounded";

import AnimatedCounter from "../common/AnimatedCounter";
import DashboardCard from "../common/DashboardCard";
import type { TypeFilter } from "./types";

interface StatItem {
  title: string;
  value: number | string;
  isString?: boolean;
  icon: SvgIconComponent;
  color: string;
  subtitle: string;
  filterValue?: TypeFilter;
}

interface Props {
  totalFiles: number;
  totalSizeFormatted: string;
  imagesCount: number;
  videosCount: number;
  loading?: boolean;
  onStatClick?: (filter: TypeFilter) => void;
}

function StatCardContent({
  title,
  value,
  isString,
  icon: Icon,
  color,
  subtitle,
  filterValue,
  onStatClick,
  loading,
}: StatItem & { onStatClick?: (filter: TypeFilter) => void; loading?: boolean }) {
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

        {isString ? (
          <Typography
            sx={{
              fontSize: 32,
              fontWeight: 800,
              color: "#111827",
              mt: 0.5,
              letterSpacing: "-0.02em",
            }}
          >
            {loading ? "—" : value}
          </Typography>
        ) : (
          <AnimatedCounter value={value as number} loading={loading} />
        )}

        <Typography sx={{ color: "#94A3B8", fontSize: 12, mt: 1, fontWeight: 500 }}>
          {subtitle}
          {clickable && (
            <Box component="span" sx={{ color: "#0EA5E9", ml: 0.5 }}>
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

export default function MediaStatsRow({
  totalFiles,
  totalSizeFormatted,
  imagesCount,
  videosCount,
  loading = false,
  onStatClick,
}: Props) {
  const stats: StatItem[] = [
    {
      title: "Total Files",
      value: totalFiles,
      icon: InsertDriveFileRoundedIcon,
      color: "#0EA5E9",
      subtitle: "Uploaded assets",
      filterValue: "All",
    },
    {
      title: "Total Size",
      value: totalSizeFormatted,
      isString: true,
      icon: StorageRoundedIcon,
      color: "#8B5CF6",
      subtitle: "Storage used",
    },
    {
      title: "Images",
      value: imagesCount,
      icon: ImageRoundedIcon,
      color: "#F59E0B",
      subtitle: "Static visuals",
      filterValue: "Image",
    },
    {
      title: "Videos",
      value: videosCount,
      icon: MovieRoundedIcon,
      color: "#EC4899",
      subtitle: "Motion graphics",
      filterValue: "Video",
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
