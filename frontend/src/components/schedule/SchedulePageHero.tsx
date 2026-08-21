import { Box, Button, IconButton, Tooltip, Typography } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";

interface Props {
  totalSchedules: number;
  onCreate: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
}

export default function SchedulePageHero({
  totalSchedules,
  onCreate,
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
        background: "linear-gradient(135deg, #F59E0B 0%, #D97706 50%, #B45309 100%)",
        color: "#fff",
        boxShadow: "0 10px 30px -5px rgba(217, 119, 6, 0.3)",
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
              <CalendarMonthRoundedIcon sx={{ fontSize: { xs: 18, sm: 22 } }} />
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
              Playback Scheduling
            </Typography>

            {totalSchedules > 0 && (
              <Box
                sx={{
                  bgcolor: "rgba(255,255,255,0.2)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 11,
                  px: 1,
                  py: 0.25,
                  borderRadius: "12px",
                  border: "1px solid rgba(255,255,255,0.25)",
                  backdropFilter: "blur(4px)",
                }}
              >
                {totalSchedules} Active
              </Box>
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
            Schedules
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
            Manage when and where your playlists are displayed. Configure complex rules, dates, and priorities.
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
            startIcon={<AddRoundedIcon />}
            onClick={onCreate}
            sx={{
              textTransform: "none",
              fontWeight: 700,
              borderRadius: "12px",
              px: { xs: 2.5, sm: 3 },
              py: { xs: 1, sm: 1.15 },
              fontSize: { xs: 13, sm: 14 },
              bgcolor: "#FFFFFF",
              color: "#D97706",
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
            Create Schedule
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
