import { Box, Button, Chip, IconButton, Tooltip, Typography } from "@mui/material";
import AddPhotoAlternateRoundedIcon from "@mui/icons-material/AddPhotoAlternateRounded";
import PermMediaRoundedIcon from "@mui/icons-material/PermMediaRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";

interface Props {
  totalFiles: number;
  totalSizeFormatted: string;
  onUpload: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
}

export default function MediaPageHero({
  totalFiles,
  totalSizeFormatted,
  onUpload,
  onRefresh,
  refreshing = false,
}: Props) {
  return (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: { xs: "20px", sm: "24px" },
        p: { xs: 2.5, sm: 3.5, md: 4 },
        mb: { xs: 2.5, sm: 3.5 },
        background: "linear-gradient(135deg, #0EA5E9 0%, #2563EB 50%, #4F46E5 100%)",
        color: "#fff",
        boxShadow: "0 10px 30px -5px rgba(37, 99, 235, 0.3)",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          top: -40,
          right: -40,
          width: 200,
          height: 200,
          borderRadius: "50%",
          bgcolor: "rgba(255,255,255,0.08)",
          pointerEvents: "none",
        }}
      />

      <Box
        sx={{
          position: "absolute",
          bottom: -60,
          right: 120,
          width: 140,
          height: 140,
          borderRadius: "50%",
          bgcolor: "rgba(255,255,255,0.06)",
          pointerEvents: "none",
        }}
      />

      <Box
        sx={{
          position: "relative",
          display: "flex",
          justifyContent: "space-between",
          alignItems: { xs: "stretch", sm: "flex-start", lg: "center" },
          flexDirection: { xs: "column", lg: "row" },
          gap: { xs: 2.5, sm: 3 },
        }}
      >
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1 }}>
            <Box
              sx={{
                width: { xs: 32, sm: 38 },
                height: { xs: 32, sm: 38 },
                borderRadius: "10px",
                bgcolor: "rgba(255,255,255,0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backdropFilter: "blur(4px)",
              }}
            >
              <PermMediaRoundedIcon sx={{ fontSize: { xs: 18, sm: 22 } }} />
            </Box>

            <Typography
              sx={{
                fontSize: { xs: 11, sm: 12.5 },
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                opacity: 0.9,
              }}
            >
              Media Library
            </Typography>

            {totalFiles > 0 && (
              <Chip
                label={totalSizeFormatted}
                size="small"
                sx={{
                  bgcolor: "rgba(255,255,255,0.2)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 11,
                  border: "1px solid rgba(255,255,255,0.25)",
                  height: 22,
                  backdropFilter: "blur(4px)",
                }}
              />
            )}
          </Box>

          <Typography
            sx={{
              fontSize: { xs: 24, sm: 30, md: 34 },
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: "-0.025em",
            }}
          >
            Media Library
          </Typography>

          <Typography
            sx={{
              mt: 1,
              fontSize: { xs: 13, sm: 14.5 },
              opacity: 0.9,
              maxWidth: 540,
              lineHeight: 1.5,
            }}
          >
            Manage and organize all your images and videos. Upload high-res assets to display on screens.
          </Typography>
        </Box>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: { xs: 1, sm: 1.5 },
            flexWrap: "nowrap",
            width: { xs: "100%", sm: "auto" },
          }}
        >
          <Tooltip title="Refresh">
            <IconButton
              onClick={onRefresh}
              disabled={refreshing}
              sx={{
                bgcolor: "rgba(255,255,255,0.15)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.25)",
                borderRadius: "12px",
                width: { xs: 40, sm: 44 },
                height: { xs: 40, sm: 44 },
                minWidth: { xs: 40, sm: 44 },
                backdropFilter: "blur(4px)",
                animation: refreshing ? "spin 0.8s linear infinite" : "none",
                "@keyframes spin": {
                  from: { transform: "rotate(0deg)" },
                  to: { transform: "rotate(360deg)" },
                },
                "&:hover": { bgcolor: "rgba(255,255,255,0.25)" },
              }}
            >
              <RefreshRoundedIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>

          <Button
            variant="contained"
            startIcon={<AddPhotoAlternateRoundedIcon />}
            onClick={onUpload}
            sx={{
              textTransform: "none",
              fontWeight: 700,
              borderRadius: "12px",
              px: { xs: 2.5, sm: 3 },
              py: { xs: 1, sm: 1.15 },
              fontSize: { xs: 13, sm: 14 },
              bgcolor: "#FFFFFF",
              color: "#2563EB",
              whiteSpace: "nowrap",
              flex: { xs: 1, sm: "initial" },
              boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
              "&:hover": {
                bgcolor: "#F8FAFC",
                transform: "translateY(-1px)",
                boxShadow: "0 6px 20px rgba(0,0,0,0.2)",
              },
            }}
          >
            Upload Media
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
