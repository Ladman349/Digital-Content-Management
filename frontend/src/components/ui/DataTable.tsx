import { Box, Button, Checkbox, Skeleton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel, Typography } from "@mui/material";
import { useMemo, useState, type ReactNode } from "react";
import { useIsPhone } from "../../hooks/useIsPhone";
import ErrorState from "./ErrorState";

export interface Column<T> {
  key: string;
  label: ReactNode;
  width?: number | string;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  render: (row: T) => ReactNode;
  hideBelow?: "sm" | "md" | "lg";
  /** Shown in the mobile card's secondary line. Without any, the card falls back to the first three columns. */
  onCard?: boolean;
  /** Names the row on a phone card. Defaults to the "name" column, then to the first column. */
  lead?: boolean;
}

export interface SortState {
  key: string;
  direction: "asc" | "desc";
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  /** Message from a failed load. Shown in place of the rows so a broken API never looks like an empty board. */
  error?: string | null;
  onRetry?: () => void;
  /** What the rows are, for the error slat: "screens", "files". */
  noun?: string;
  emptyState?: ReactNode;
  selectable?: boolean;
  selected?: Set<string>;
  onSelectionChange?: (next: Set<string>) => void;
  onRowClick?: (row: T) => void;
  activeRowKey?: string | null;
  sort?: SortState;
  onSortChange?: (next: SortState) => void;
  pageSize?: number;
  maxHeight?: number | string;
  rowHighlight?: (row: T) => "warning" | "error" | undefined;
  /** Rows that are still listed but carry no weight — unused media, unpublished drafts. */
  rowDim?: (row: T) => boolean;
}

/**
 * The board. Rows are slats separated by a 2px gap rather than ruled lines, which is what makes a list
 * read as a timetable instead of a spreadsheet.
 *
 * Below the `sm` breakpoint the table becomes a stack of cards — a board row is wider than a phone, and
 * scrolling one sideways to read its status defeats the point of a status you can see at a glance.
 */
export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  noun = "rows",
  emptyState,
  selectable,
  selected,
  onSelectionChange,
  onRowClick,
  activeRowKey,
  sort,
  onSortChange,
  pageSize = 100,
  maxHeight,
  rowHighlight,
  rowDim,
}: Props<T>) {
  const [limit, setLimit] = useState(pageSize);
  const isPhone = useIsPhone();

  const visible = useMemo(() => rows.slice(0, limit), [rows, limit]);
  const allKeys = useMemo(() => rows.map(rowKey), [rows, rowKey]);
  const allSelected = Boolean(selectable && selected && rows.length > 0 && allKeys.every((k) => selected.has(k)));
  const someSelected = Boolean(selectable && selected && selected.size > 0 && !allSelected);

  // A load that failed before anything arrived: say so instead of shimmering or claiming "no rows".
  const failedEmpty = Boolean(error) && rows.length === 0;
  const showSkeleton = Boolean(loading) && rows.length === 0 && !error;
  const showEmpty = !loading && rows.length === 0 && !error;

  const toggleAll = () => {
    if (!onSelectionChange) return;
    onSelectionChange(allSelected ? new Set() : new Set(allKeys));
  };

  const toggleOne = (key: string) => {
    if (!onSelectionChange || !selected) return;
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectionChange(next);
  };

  const hideSx = (c: Column<T>) => (c.hideBelow ? { display: { xs: "none", [c.hideBelow]: "table-cell" } } : undefined);

  const errorSlat = failedEmpty && <ErrorState noun={noun} message={error} onRetry={onRetry} />;

  const showMore = rows.length > limit && (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, py: 1.5, flexWrap: "wrap" }}>
      <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: "text.secondary" }}>
        Showing {limit} of {rows.length}
      </Typography>
      <Button size="small" onClick={() => setLimit((l) => l + pageSize)}>
        Show more
      </Button>
      <Button size="small" onClick={() => setLimit(rows.length)}>
        Show all
      </Button>
    </Box>
  );

  // ── Phone: cards ──────────────────────────────────────────────────────────
  if (isPhone) {
    // A card is led by what the row *is* — its name — not by whichever column happens to sort first.
    const lead = columns.find((c) => c.lead) ?? columns.find((c) => c.key === "name") ?? columns[0];
    const marked = columns.filter((c) => c.onCard && c.key !== lead?.key);
    const cardCols = marked.length ? marked : columns.filter((c) => c.key !== lead?.key && c.key !== "actions").slice(0, 3);
    const actions = columns.find((c) => c.key === "actions");

    return (
      <Box>
        {showSkeleton && (
          <Box sx={{ display: "grid", gap: "2px" }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={`sk-${i}`} variant="rectangular" height={78} />
            ))}
          </Box>
        )}
        {errorSlat}
        {showEmpty && emptyState}
        <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "2px" }}>
          {visible.map((row) => {
            const key = rowKey(row);
            const isSelected = selected?.has(key) ?? false;
            const isActive = activeRowKey === key;
            const highlight = rowHighlight?.(row);
            return (
              <Box
                key={key}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                role={onRowClick ? "button" : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                sx={(t) => ({
                  bgcolor: isActive ? t.palette.surface.hover : t.palette.board.cell,
                  p: 1.5,
                  minWidth: 0,
                  cursor: onRowClick ? "pointer" : "default",
                  opacity: rowDim?.(row) ? 0.55 : 1,
                  boxShadow: isActive
                    ? `inset 3px 0 0 ${t.palette.board.amber}`
                    : highlight
                      ? `inset 3px 0 0 ${t.palette[highlight].main}`
                      : "none",
                })}
              >
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                  {selectable && (
                    <Box onClick={(e) => e.stopPropagation()} sx={{ mt: -0.5, ml: -0.75 }}>
                      <Checkbox size="small" checked={isSelected} onChange={() => toggleOne(key)} slotProps={{ input: { "aria-label": `Select ${key}` } }} />
                    </Box>
                  )}
                  <Box sx={{ minWidth: 0, flex: 1 }}>{lead?.render(row)}</Box>
                  {actions && <Box onClick={(e) => e.stopPropagation()}>{actions.render(row)}</Box>}
                </Box>
                {cardCols.length > 0 && (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, mt: 1.25, pt: 1.25, borderTop: 1, borderColor: "surface.border" }}>
                    {cardCols.map((c) => (
                      <Box key={c.key} sx={{ minWidth: 0 }}>
                        <Typography component="div" variant="subtitle2" sx={{ color: "text.secondary", mb: 0.25 }}>
                          {c.label}
                        </Typography>
                        <Box sx={{ fontSize: 12.5 }}>{c.render(row)}</Box>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
        {showMore}
      </Box>
    );
  }

  // ── Desktop: the board ────────────────────────────────────────────────────
  return (
    <Box>
      <TableContainer sx={{ maxHeight }}>
        <Table stickyHeader size="small" sx={{ minWidth: 720 }}>
          <TableHead>
            <TableRow>
              {selectable && (
                <TableCell padding="checkbox" sx={{ width: 44, bgcolor: "transparent" }}>
                  <Checkbox size="small" indeterminate={someSelected} checked={allSelected} onChange={toggleAll} slotProps={{ input: { "aria-label": "Select all rows" } }} />
                </TableCell>
              )}
              {columns.map((c) => (
                <TableCell key={c.key} align={c.align} sx={{ width: c.width, ...hideSx(c) }} sortDirection={sort?.key === c.key ? sort.direction : false}>
                  {c.sortable && onSortChange ? (
                    <TableSortLabel
                      active={sort?.key === c.key}
                      direction={sort?.key === c.key ? sort.direction : "asc"}
                      onClick={() => onSortChange({ key: c.key, direction: sort?.key === c.key && sort.direction === "asc" ? "desc" : "asc" })}
                    >
                      {c.label}
                    </TableSortLabel>
                  ) : (
                    c.label
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {showSkeleton &&
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  {selectable && <TableCell padding="checkbox" />}
                  {columns.map((c) => (
                    <TableCell key={c.key} sx={hideSx(c)}>
                      <Skeleton height={20} width={c.key === "name" ? "70%" : "50%"} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {(showEmpty || failedEmpty) && (
              <TableRow>
                <TableCell colSpan={columns.length + (selectable ? 1 : 0)} sx={{ p: 0, bgcolor: "transparent" }}>
                  {failedEmpty ? errorSlat : emptyState}
                </TableCell>
              </TableRow>
            )}
            {visible.map((row) => {
              const key = rowKey(row);
              const isSelected = selected?.has(key) ?? false;
              const isActive = activeRowKey === key;
              const highlight = rowHighlight?.(row);
              const dim = rowDim?.(row) ?? false;
              return (
                <TableRow
                  key={key}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  sx={(t) => ({
                    cursor: onRowClick ? "pointer" : "default",
                    "& td": {
                      backgroundColor: isActive || isSelected ? t.palette.surface.hover : t.palette.board.cell,
                      opacity: dim ? 0.55 : 1,
                      transition: "background-color .12s",
                    },
                    "&:hover td": { backgroundColor: t.palette.surface.hover },
                    "& td:first-of-type": {
                      boxShadow: isActive
                        ? `inset 3px 0 0 ${t.palette.board.amber}`
                        : highlight
                          ? `inset 3px 0 0 ${t.palette[highlight].main}`
                          : "none",
                    },
                  })}
                >
                  {selectable && (
                    <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                      <Checkbox size="small" checked={isSelected} onChange={() => toggleOne(key)} slotProps={{ input: { "aria-label": `Select ${key}` } }} />
                    </TableCell>
                  )}
                  {columns.map((c) => (
                    <TableCell key={c.key} align={c.align} sx={hideSx(c)}>
                      {c.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      {showMore}
    </Box>
  );
}
