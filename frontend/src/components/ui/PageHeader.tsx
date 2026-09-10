import { Box } from "@mui/material";
import type { ReactNode } from "react";

interface Props {
  /** The board header already names the page; this stays for the accessible label on the toolbar. */
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}

/**
 * The toolbar above a board: search and filters on the left, the primary action on the right.
 * The page name itself lives in the board header, so it is not repeated here.
 */
export default function PageHeader({ title, meta, actions, children }: Props) {
  const hasToolbar = Boolean(children) || Boolean(meta);
  return (
    <Box component="section" aria-label={`${title} toolbar`} sx={{ mb: 1.5 }}>
      {hasToolbar && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            flexWrap: "wrap",
            pb: 1.25,
            borderBottom: 1,
            borderColor: "surface.border",
          }}
        >
          {children}
          <Box sx={{ flex: 1, minWidth: 8 }} />
          {meta && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                color: "text.secondary",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.11em",
                textTransform: "uppercase",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {meta}
            </Box>
          )}
          {actions && <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>{actions}</Box>}
        </Box>
      )}
      {!hasToolbar && actions && <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, pb: 1.25 }}>{actions}</Box>}
    </Box>
  );
}
