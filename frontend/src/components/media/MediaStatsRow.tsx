import { Box, Skeleton, Typography } from "@mui/material";
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

        {isString ? (
          <Typography
            sx={{
              fontSize: { xs: 20, sm: 26, md: 30 },
              fontWeight: 800,
              color: "#0F172A",
              mt: 0.5,
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
            }}
          >
            {loading ? "—" : value}
          </Typography>
        ) : (
          <AnimatedCounter value={value as number} loading={loading} />
        )}

        <Typography sx={{ color: "#94A3B8", fontSize: { xs: 11, sm: 12 }, mt: { xs: 0.5, sm: 1 }, fontWeight: 500 }}>
          {subtitle}
          {clickable && (
            <Box component="span" sx={{ color: "#0EA5E9", ml: 0.5, fontWeight: 600 }}>
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
