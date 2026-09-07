import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";

interface Props {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}

/** Compact page header: title + inline metadata on the left, primary actions on the right, filter row beneath. */
export default function PageHeader({ title, meta, actions, children }: Props) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", minHeight: 36 }}>
        <Typography variant="h1" component="h1">
          {title}
        </Typography>
        {meta && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary", fontSize: 13 }}>
            {meta}
          </Box>
        )}
        <Box sx={{ flex: 1 }} />
        {actions && <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>{actions}</Box>}
      </Box>
      {children && <Box sx={{ mt: 1.25, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>{children}</Box>}
    </Box>
  );
}
