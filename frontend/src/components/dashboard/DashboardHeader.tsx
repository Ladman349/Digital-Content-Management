import { Box, Typography } from "@mui/material";

export default function DashboardHeader() {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 2,
        mb: { xs: 2.5, sm: 3.5 },
      }}
    >
      <Box>
        <Typography
          sx={{
            fontSize: { xs: 24, sm: 28, md: 32 },
            fontWeight: 800,
            color: "#0F172A",
            letterSpacing: "-0.025em",
          }}
        >
          Dashboard Overview
        </Typography>

        <Typography
          sx={{
            mt: 0.5,
            color: "#64748B",
            fontSize: { xs: 13.5, sm: 15 },
            fontWeight: 500,
          }}
        >
          Welcome back, Akash 👋 Here's your signage system status today.
        </Typography>
      </Box>
    </Box>
  );
}