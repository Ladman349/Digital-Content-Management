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

export default function EmptyState({ icon: Icon, title, description, actionLabel, onAction, compact }: Props) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", py: compact ? 4 : 7, px: 3 }}>
      <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: "surface.hover", display: "grid", placeItems: "center", mb: 1.5, color: "text.secondary" }}>
        <Icon sx={{ fontSize: 24 }} />
      </Box>
      <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{title}</Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 380 }}>
          {description}
        </Typography>
      )}
      {actionLabel && onAction && (
        <Button variant="contained" onClick={onAction} sx={{ mt: 2 }}>
          {actionLabel}
        </Button>
      )}
    </Box>
  );
}
