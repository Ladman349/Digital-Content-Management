import { Box } from "@mui/material";
import type { ReactNode } from "react";
import { useIsCompact } from "../../hooks/useIsPhone";

interface Props {
  /** The board header already names the page; this stays for the accessible label on the toolbar. */
  title: string;
  /** The search field. Stretches to fill the row on phones. */
  search?: ReactNode;
  /** Segmented filters, selects and the clear button. Scrolls sideways on phones instead of wrapping. */
  filters?: ReactNode;
  /** "12 screens" or "3 of 12" — how much of the board is showing. */
  count?: ReactNode;
  /** Totals for the whole collection: "4 online · 1 offline", "116 MB". */
  meta?: ReactNode;
  /** View switches: list/grid, list/timeline. */
  tools?: ReactNode;
  /** The primary action. Sits beside the search on phones so it is never pushed below the fold. */
  actions?: ReactNode;
}

const statusSx = {
  display: "flex",
  alignItems: "center",
  gap: 1,
  minWidth: 0,
  color: "text.secondary",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.11em",
  textTransform: "uppercase",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
} as const;

/**
 * The toolbar above a board: search and filters on the left, the primary action on the right.
 * The page name itself lives in the board header, so it is not repeated here.
 *
 * Below `md` the single row has no room to be a row, so it becomes three deliberate lines — search
 * with the primary action, then filters, then the count and view switches — rather than one flex-wrap
 * that lands controls wherever they happen to fit.
 */
export default function PageHeader({ title, search, filters, count, meta, tools, actions }: Props) {
  const compact = useIsCompact();
  const hasStatus = Boolean(count) || Boolean(meta);

  if (compact) {
    return (
      <Box component="section" aria-label={`${title} toolbar`} sx={{ mb: 1.5, pb: 1.25, borderBottom: 1, borderColor: "surface.border", display: "grid", gap: 1.25 }}>
        {(search || actions) && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
            <Box sx={{ flex: 1, minWidth: 0, display: "flex", "& > *": { flex: 1, minWidth: 0 } }}>{search}</Box>
            {actions && <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>{actions}</Box>}
          </Box>
        )}
        {filters && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              overflowX: "auto",
              scrollbarWidth: "none",
              "&::-webkit-scrollbar": { display: "none" },
              // Fade the trailing edge so a clipped chip reads as "more to the right", not "cut off".
              maskImage: "linear-gradient(to right, #000 calc(100% - 24px), transparent)",
              WebkitMaskImage: "linear-gradient(to right, #000 calc(100% - 24px), transparent)",
              pr: 3,
              mx: -2,
              px: 2,
              "& > *": { flexShrink: 0 },
            }}
          >
            {filters}
          </Box>
        )}
        {(hasStatus || tools) && (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, minWidth: 0 }}>
            <Box sx={{ ...statusSx, overflow: "hidden", textOverflow: "ellipsis" }}>
              {count}
              {count && meta && <span>·</span>}
              {meta}
            </Box>
            {tools && <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>{tools}</Box>}
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box component="section" aria-label={`${title} toolbar`} sx={{ mb: 1.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", pb: 1.25, borderBottom: 1, borderColor: "surface.border" }}>
        {search}
        {filters}
        <Box sx={{ flex: 1, minWidth: 8 }} />
        {hasStatus && (
          <Box sx={statusSx}>
            {count}
            {count && meta && <span>·</span>}
            {meta}
          </Box>
        )}
        {tools}
        {actions && <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>{actions}</Box>}
      </Box>
    </Box>
  );
}
