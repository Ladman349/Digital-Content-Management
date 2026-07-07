import { Box, Typography } from "@mui/material";
import PlayCircleFilledRoundedIcon from "@mui/icons-material/PlayCircleFilledRounded";

export default function Logo() {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        px: 3,
        py: 3,
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: 3,
          background: "linear-gradient(135deg,#6C4CF1,#8B5CF6)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          bboxShadow: "0 15px 35px rgba(108,76,241,.45)",
        }}
      >
        <PlayCircleFilledRoundedIcon
          sx={{
            color: "#fff",
            fontSize: 28,
          }}
        />
      </Box>

      <Box>
        <Typography
          sx={{
            color: "#fff",
            fontWeight: 700,
            fontSize: 20,
          }}
        >
          Signage CMS
        </Typography>

        <Typography
          sx={{
            color: "#94A3B8",
            fontSize: 12,
          }}
        >
          Digital Signage Platform
        </Typography>
      </Box>
    </Box>
  );
}