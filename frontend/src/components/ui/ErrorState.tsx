import { Box, Button, Typography } from "@mui/material";
import CloudOffRoundedIcon from "@mui/icons-material/CloudOffRounded";

interface Props {
  /** What failed to load, e.g. "screens". */
  noun: string;
  message?: string | null;
  onRetry?: () => void;
  compact?: boolean;
}

/**
 * A slat that says the board could not be filled. A list that never loads is indistinguishable from
 * an empty one, so a failed request gets its own state instead of skeletons that shimmer forever.
 */
export default function ErrorState({ noun, message, onRetry, compact }: Props) {
  return (
    <Box
      role="alert"
      sx={(t) => ({
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        py: compact ? 3 : 6,
        px: 3,
        bgcolor: "board.cell",
        boxShadow: `inset 3px 0 0 ${t.palette.error.main}`,
      })}
    >
      <CloudOffRoundedIcon sx={{ fontSize: 26, color: "error.main", mb: 1.5 }} />
      <Typography sx={{ fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em" }}>
        Could not load {noun}
      </Typography>
      {message && (
        <Typography sx={{ mt: 0.75, maxWidth: 440, fontSize: 12.5, color: "text.secondary", lineHeight: 1.55, overflowWrap: "anywhere" }}>
          {message}
        </Typography>
      )}
      {onRetry && (
        <Button variant="outlined" onClick={onRetry} sx={{ mt: 2.5 }}>
          Try again
        </Button>
      )}
    </Box>
  );
}
