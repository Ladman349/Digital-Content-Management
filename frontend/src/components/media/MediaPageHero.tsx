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
        borderRadius: "24px",
        p: { xs: 3, md: 4 },
        mb: 4,
        background: "linear-gradient(135deg, #0EA5E9 0%, #3B82F6 50%, #4F46E5 100%)",
        color: "#fff",
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
        }}
      />

      <Box
        sx={{
          position: "absolute",
          top: 20,
          left: "55%",
          width: 80,
          height: 80,
          borderRadius: "50%",
          bgcolor: "rgba(255,255,255,0.04)",
          display: { xs: "none", md: "block" },
        }}
      />

      <Box
        sx={{
          position: "relative",
          display: "flex",
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", lg: "center" },
          flexDirection: { xs: "column", lg: "row" },
          gap: 3,
        }}
      >
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: "12px",
                bgcolor: "rgba(255,255,255,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <PermMediaRoundedIcon />
            </Box>

            <Typography
              sx={{
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                opacity: 0.85,
              }}
            >
              Media Library
            </Typography>

            {totalFiles > 0 && (
              <Chip
                label={totalSizeFormatted}
                size="small"
                sx={{
                  bgcolor: "rgba(255,255,255,0.15)",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 11,
                  border: "1px solid rgba(255,255,255,0.2)",
                  height: 24,
                }}
              />
            )}
          </Box>

          <Typography
            sx={{
              fontSize: { xs: 28, md: 34 },
              fontWeight: 800,
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
            }}
          >
            Media
          </Typography>

          <Typography
            sx={{
              mt: 1.5,
              fontSize: 15,
              opacity: 0.88,
              maxWidth: 480,
              lineHeight: 1.6,
            }}
          >
            Manage and organize all your images and videos. Upload new assets to
            display on your digital signage screens.
          </Typography>

          <Typography
            sx={{
              mt: 2,
              fontSize: 13,
              fontWeight: 600,
              opacity: 0.75,
            }}
          >
            {totalFiles} file{totalFiles !== 1 ? "s" : ""} uploaded
          </Typography>
        </Box>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            flexWrap: "wrap",
          }}
        >
          <Tooltip title="Refresh">
            <IconButton
              onClick={onRefresh}
              disabled={refreshing}
              sx={{
                bgcolor: "rgba(255,255,255,0.12)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "12px",
                width: 44,
                height: 44,
                animation: refreshing ? "spin 0.8s linear infinite" : "none",
                "@keyframes spin": {
                  from: { transform: "rotate(0deg)" },
                  to: { transform: "rotate(360deg)" },
                },
                "&:hover": { bgcolor: "rgba(255,255,255,0.2)" },
              }}
            >
              <RefreshRoundedIcon />
            </IconButton>
          </Tooltip>

          <Button
            variant="contained"
            startIcon={<AddPhotoAlternateRoundedIcon />}
            onClick={onUpload}
            sx={{
              textTransform: "none",
              fontWeight: 700,
              borderRadius: "14px",
              px: 3,
              py: 1.25,
              bgcolor: "#fff",
              color: "#3B82F6",
              whiteSpace: "nowrap",
              boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
              "&:hover": {
                bgcolor: "#F8FAFC",
                boxShadow: "0 12px 32px rgba(0,0,0,0.2)",
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
