import { Paper } from "@mui/material";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export default function DashboardCard({ children }: Props) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: "20px",
        border: "1px solid #EEF2F7",
        bgcolor: "#FFFFFF",
        boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
        transition: "all .25s ease",

        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: "0 18px 40px rgba(15,23,42,0.10)",
        },
      }}
    >
      {children}
    </Paper>
  );
}