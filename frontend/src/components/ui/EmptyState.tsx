import { Box, Button, Typography } from "@mui/material";
import type { SvgIconComponent } from "@mui/icons-material";

interface Props {
  icon: SvgIconComponent;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

/** An unlit slat: the board's empty state keeps the row shape rather than dropping into a blank panel. */
export default function EmptyState({ icon: Icon, title, description, actionLabel, onAction, compact }: Props) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        py: compact ? 4 : 7,
        px: 3,
        bgcolor: "board.cell",
      }}
    >
      <Icon sx={{ fontSize: 26, color: "text.disabled", mb: 1.5 }} />
      <Typography sx={{ fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em" }}>{title}</Typography>
      {description && (
        <Typography sx={{ mt: 0.75, maxWidth: 420, fontSize: 12.5, color: "text.secondary", lineHeight: 1.55 }}>{description}</Typography>
      )}
      {actionLabel && onAction && (
        <Button variant="contained" onClick={onAction} sx={{ mt: 2.5 }}>
          {actionLabel}
        </Button>
      )}
    </Box>
  );
}
