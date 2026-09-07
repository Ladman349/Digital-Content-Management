import { Box, Button, Checkbox, Skeleton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel, Typography } from "@mui/material";
import { useMemo, useState, type ReactNode } from "react";

export interface Column<T> {
  key: string;
  label: ReactNode;
  width?: number | string;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  render: (row: T) => ReactNode;
  hideBelow?: "sm" | "md" | "lg";
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
}

/**
 * Dense, sortable, multi-select table with a sticky header. Sorting is controlled by the parent; this component only
 * renders. Rows beyond `pageSize` are revealed with "Show more" so large libraries keep the DOM light.
 */
export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
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
}: Props<T>) {
  const [limit, setLimit] = useState(pageSize);
  const visible = useMemo(() => rows.slice(0, limit), [rows, limit]);
  const allKeys = useMemo(() => rows.map(rowKey), [rows, rowKey]);
  const allSelected = Boolean(selectable && selected && rows.length > 0 && allKeys.every((k) => selected.has(k)));
  const someSelected = Boolean(selectable && selected && selected.size > 0 && !allSelected);

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

  return (
    <Box sx={{ border: 1, borderColor: "surface.border", borderRadius: 2, bgcolor: "background.paper", overflow: "hidden" }}>
      <TableContainer sx={{ maxHeight }}>
        <Table stickyHeader size="small" sx={{ minWidth: 640 }}>
          <TableHead>
            <TableRow>
              {selectable && (
                <TableCell padding="checkbox" sx={{ width: 40 }}>
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
            {loading &&
              rows.length === 0 &&
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  {selectable && <TableCell padding="checkbox" />}
                  {columns.map((c) => (
                    <TableCell key={c.key} sx={hideSx(c)}>
                      <Skeleton height={18} width={c.key === "name" ? "70%" : "50%"} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length + (selectable ? 1 : 0)} sx={{ p: 0, borderBottom: 0 }}>
                  {emptyState}
                </TableCell>
              </TableRow>
            )}
            {visible.map((row) => {
              const key = rowKey(row);
              const isSelected = selected?.has(key) ?? false;
              const isActive = activeRowKey === key;
              const highlight = rowHighlight?.(row);
              return (
                <TableRow
                  key={key}
                  hover
                  selected={isSelected || isActive}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  sx={(theme) => ({
                    cursor: onRowClick ? "pointer" : "default",
                    height: 46,
                    "&.Mui-selected": { bgcolor: isActive ? `${theme.palette.primary.main}14` : `${theme.palette.primary.main}0C` },
                    "&.Mui-selected:hover": { bgcolor: `${theme.palette.primary.main}1A` },
                    boxShadow: isActive ? `inset 3px 0 0 ${theme.palette.primary.main}` : highlight ? `inset 3px 0 0 ${theme.palette[highlight].main}` : "none",
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
      {rows.length > limit && (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, py: 1, borderTop: 1, borderColor: "surface.border" }}>
          <Typography variant="body2" color="text.secondary">
            Showing {limit} of {rows.length}
          </Typography>
          <Button size="small" onClick={() => setLimit((l) => l + pageSize)}>
            Show more
          </Button>
          <Button size="small" onClick={() => setLimit(rows.length)}>
            Show all
          </Button>
        </Box>
      )}
    </Box>
  );
}
