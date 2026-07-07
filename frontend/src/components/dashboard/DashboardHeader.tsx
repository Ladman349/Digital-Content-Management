import { Box, Typography } from "@mui/material";

export default function DashboardHeader() {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 3,
        mb: 4,
      }}
    >
      <Box>
        <Typography
          sx={{
            fontSize: 32,
            fontWeight: 800,
            color: "#111827",
          }}
        >
          Dashboard
        </Typography>

        <Typography
          sx={{
            mt: 1,
            color: "#6B7280",
            fontSize: 15,
          }}
        >
          Welcome back, Akash 👋
        </Typography>
      </Box>
    </Box>
  );
}