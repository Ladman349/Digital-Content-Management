import { Box, Button, Typography } from "@mui/material";
import type { SvgIconComponent } from "@mui/icons-material";

interface Props {
  icon: SvgIconComponent;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: Props) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        py: 8,
        px: 3,
        textAlign: "center",
      }}
    >
      <Box
        sx={{
          width: 72,
          height: 72,
          borderRadius: "20px",
          bgcolor: "#EEF2FF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          mb: 3,
        }}
      >
        <Icon sx={{ fontSize: 36, color: "#6C4CF1" }} />
      </Box>

      <Typography
        sx={{
          fontSize: 20,
          fontWeight: 700,
          color: "#111827",
          mb: 1,
        }}
      >
        {title}
      </Typography>

      <Typography
        sx={{
          color: "#64748B",
          fontSize: 15,
          maxWidth: 360,
          lineHeight: 1.6,
          mb: actionLabel ? 3 : 0,
        }}
      >
        {description}
      </Typography>

      {actionLabel && onAction && (
        <Button
          variant="contained"
          onClick={onAction}
          sx={{
            textTransform: "none",
            fontWeight: 700,
            borderRadius: "14px",
            px: 3,
            background: "linear-gradient(135deg,#6C4CF1,#8B5CF6)",
            "&:hover": {
              background: "linear-gradient(135deg,#5B3DF5,#7C4DFF)",
            },
          }}
        >
          {actionLabel}
        </Button>
      )}
    </Box>
  );
}
