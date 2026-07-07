import { Box, Button, Typography } from "@mui/material";

import AddRoundedIcon from "@mui/icons-material/AddRounded";

interface DeviceHeaderProps {
  onAddDevice: () => void;
}

export default function DeviceHeader({
  onAddDevice,
}: DeviceHeaderProps) {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        mb: 4,
        flexWrap: "wrap",
        gap: 2,
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
          Devices
        </Typography>

        <Typography
          sx={{
            mt: 1,
            color: "#64748B",
            fontSize: 15,
          }}
        >
          Manage all connected digital signage displays.
        </Typography>
      </Box>

      <Button
        variant="contained"
        startIcon={<AddRoundedIcon />}
        onClick={onAddDevice}
        sx={{
          px: 3,
          height: 48,
          borderRadius: "14px",
          textTransform: "none",
          fontWeight: 700,
          background:
            "linear-gradient(135deg,#6C4CF1,#8B5CF6)",

          "&:hover": {
            background:
              "linear-gradient(135deg,#5B3DF5,#7C4DFF)",
          },
        }}
      >
        Add Device
      </Button>
    </Box>
  );
}