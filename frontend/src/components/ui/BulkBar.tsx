import { Box, Button, IconButton, Paper, Typography } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import type { ReactNode } from "react";

interface Props {
  count: number;
  noun: string;
  onClear: () => void;
  children: ReactNode;
  onSelectAll?: () => void;
  total?: number;
}

/** Floating action bar shown while rows are selected. */
export default function BulkBar({ count, noun, onClear, children, onSelectAll, total }: Props) {
  if (count === 0) return null;
  return (
    <Paper
      sx={{
        position: "sticky",
        bottom: 12,
        zIndex: 5,
        mt: 1.5,
        mx: "auto",
        width: "fit-content",
        maxWidth: "100%",
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1.5,
        py: 0.75,
        borderRadius: 2,
        border: 1,
        borderColor: "surface.borderStrong",
        boxShadow: "0 12px 32px -8px rgba(0,0,0,0.3)",
        bgcolor: "background.paper",
      }}
    >
      <Typography sx={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}>
        {count} {noun}
        {count === 1 ? "" : "s"} selected
      </Typography>
      {onSelectAll && total !== undefined && count < total && (
        <Button size="small" onClick={onSelectAll} sx={{ whiteSpace: "nowrap" }}>
          Select all {total}
        </Button>
      )}
      <Box sx={{ width: "1px", height: 20, bgcolor: "divider", mx: 0.5 }} />
      <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexWrap: "wrap" }}>{children}</Box>
      <IconButton onClick={onClear} aria-label="Clear selection">
        <CloseRoundedIcon sx={{ fontSize: 18 }} />
      </IconButton>
    </Paper>
  );
}
