import type { ReactNode } from "react";
import { Box, Paper, Typography } from "@mui/material";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: ReactNode;
  color: string;
  subtitle?: string;
  onClick?: () => void;
}

export default function StatCard({
  title,
  value,
  icon,
  color,
  subtitle,
  onClick,
}: StatCardProps) {
  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        p: 3,
        borderRadius: "16px",
        border: "1px solid #EEF2F7",
        bgcolor: "#FFFFFF",
        boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
        transition: "all .25s ease",
        cursor: onClick ? "pointer" : "default",

        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: "0 18px 40px rgba(15,23,42,0.10)",
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
        {/* Icon circle */}
        <Box
          sx={{
            width: 52,
            height: 52,
            minWidth: 52,
            borderRadius: "50%",
            bgcolor: `${color}26`, // 15% opacity hex
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            color,
          }}
        >
          {icon}
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              color: "#64748B",
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: 0.2,
            }}
          >
            {title}
          </Typography>

          <Typography
            sx={{
              fontWeight: 700,
              fontSize: 28,
              lineHeight: 1.2,
              mt: 0.5,
            }}
          >
            {typeof value === "number" ? value.toLocaleString() : value}
          </Typography>

          {subtitle && (
            <Typography
              sx={{
                color: "#94A3B8",
                fontSize: 12,
                fontWeight: 400,
                mt: 0.5,
              }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
    </Paper>
  );
}