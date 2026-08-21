import { Paper } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  sx?: SxProps<Theme>;
}

export default function DashboardCard({ children, sx }: Props) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 2.5, md: 3 },
        borderRadius: { xs: "16px", sm: "20px" },
        border: "1px solid #EEF2F6",
        bgcolor: "#FFFFFF",
        boxShadow: "0 1px 3px rgba(0,0,0,0.03), 0 8px 24px -4px rgba(15,23,42,0.05)",
        transition: "all .2s cubic-bezier(0.4, 0, 0.2, 1)",

        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05), 0 16px 32px -4px rgba(15,23,42,0.08)",
          borderColor: "#E2E8F0",
        },
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
}