import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { MONO } from "../../app/theme";

/**
 * A bench row: name on the left, value hard right in mono. Reading down a column of these, the values
 * line up as a single edge, which is what makes a stack of facts scannable rather than a paragraph.
 */
export default function Field({ label, children, mono = true }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 2,
        py: 0.85,
        borderBottom: 1,
        borderColor: "surface.border",
        minWidth: 0,
      }}
    >
      <Typography component="div" sx={{ fontSize: 12.5, color: "text.secondary", flex: "0 1 auto", minWidth: 0 }}>
        {label}
      </Typography>
      <Typography
        component="div"
        sx={{
          fontFamily: mono ? MONO : undefined,
          fontSize: mono ? 11.5 : 12.5,
          fontWeight: 500,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
          overflowWrap: "anywhere",
          minWidth: 0,
        }}
      >
        {children ?? "—"}
      </Typography>
    </Box>
  );
}

/** Bench rows stack; the bench itself is already columned by DetailPanel. */
export function FieldGrid({ children }: { children: ReactNode; columns?: number }) {
  return <Box sx={{ display: "grid", gap: 0 }}>{children}</Box>;
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1.25, minHeight: 24 }}>
        <Typography variant="subtitle2" sx={{ color: "text.secondary" }}>
          {title}
        </Typography>
        {action}
      </Box>
      {children}
    </Box>
  );
}
