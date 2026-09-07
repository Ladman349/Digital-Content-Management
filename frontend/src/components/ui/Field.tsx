import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";

/** Label/value pair used inside detail panels. */
export default function Field({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontWeight: 600, mb: 0.25 }}>
        {label}
      </Typography>
      <Typography component="div" sx={{ fontSize: 13, fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : undefined, overflowWrap: "anywhere" }}>
        {children ?? "—"}
      </Typography>
    </Box>
  );
}

export function FieldGrid({ children, columns = 2 }: { children: ReactNode; columns?: number }) {
  return <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 1.5 }}>{children}</Box>;
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1, minHeight: 28 }}>
        <Typography variant="subtitle2" color="text.secondary">
          {title}
        </Typography>
        {action}
      </Box>
      {children}
    </Box>
  );
}
