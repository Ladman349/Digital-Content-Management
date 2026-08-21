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
        p: { xs: 1.75, sm: 2.5, md: 3 },
        borderRadius: { xs: 3, sm: 4 },
        border: "1px solid #EEF2F6",
        bgcolor: "#FFFFFF",
        boxShadow: "0 1px 3px rgba(0,0,0,0.03), 0 8px 24px -4px rgba(15,23,42,0.05)",
        transition: "all .2s cubic-bezier(0.4, 0, 0.2, 1)",
        cursor: onClick ? "pointer" : "default",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        height: "100%",

        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05), 0 16px 32px -4px rgba(15,23,42,0.08)",
          borderColor: "#E2E8F0",
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1.25, sm: 2 } }}>
        <Box
          sx={{
            width: { xs: 40, sm: 48 },
            height: { xs: 40, sm: 48 },
            minWidth: { xs: 40, sm: 48 },
            borderRadius: { xs: "12px", sm: "14px" },
            bgcolor: `${color}18`,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            color,
            boxShadow: `0 4px 12px ${color}20`,
          }}
        >
          {icon}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            noWrap
            sx={{
              color: "#64748B",
              fontSize: { xs: 12, sm: 13 },
              fontWeight: 600,
              letterSpacing: 0.1,
            }}
          >
            {title}
          </Typography>

          <Typography
            sx={{
              fontWeight: 800,
              fontSize: { xs: 20, sm: 26, md: 28 },
              lineHeight: 1.15,
              mt: 0.25,
              color: "#0F172A",
              letterSpacing: "-0.02em",
            }}
          >
            {typeof value === "number" ? value.toLocaleString() : value}
          </Typography>
        </Box>
      </Box>

      {subtitle && (
        <Typography
          sx={{
            color: "#94A3B8",
            fontSize: { xs: 11, sm: 12 },
            fontWeight: 500,
            mt: { xs: 1.25, sm: 1.5 },
            lineHeight: 1.3,
          }}
        >
          {subtitle}
        </Typography>
      )}
    </Paper>
  );
}