import { Alert, AlertTitle, Box, Typography } from "@mui/material";
import type { Schedule } from "../../types/schedule";

interface Props {
  conflicts: Schedule[];
}

export default function ConflictWarning({ conflicts }: Props) {
  if (!conflicts || conflicts.length === 0) return null;

  return (
    <Alert severity="error" sx={{ borderRadius: "12px", mb: 3 }}>
      <AlertTitle sx={{ fontWeight: 700 }}>Scheduling Conflict Detected</AlertTitle>
      <Typography sx={{ fontSize: 13, mb: 1 }}>
        The selected devices and time slot overlap with {conflicts.length} existing active schedule(s).
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, pl: 2, borderLeft: "2px solid rgba(239, 68, 68, 0.3)" }}>
        {conflicts.map(c => (
          <Typography key={c.id} sx={{ fontSize: 13, fontWeight: 500 }}>
            • {c.name} ({c.startTime} - {c.endTime})
          </Typography>
        ))}
      </Box>
      <Typography sx={{ fontSize: 13, mt: 1, fontWeight: 600 }}>
        The schedule with the higher priority will override others during the overlapping period.
      </Typography>
    </Alert>
  );
}
