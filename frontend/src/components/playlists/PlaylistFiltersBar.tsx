import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import ClearRoundedIcon from "@mui/icons-material/ClearRounded";
import FilterListRoundedIcon from "@mui/icons-material/FilterListRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";

import type { StatusFilter, SortField, SortDirection } from "./types";
import { hasActiveFilters } from "./utils";

interface Props {
  search: string;
  statusFilter: StatusFilter;
  sortField: SortField;
  sortDirection: SortDirection;
  resultCount: number;
  refreshing?: boolean;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: StatusFilter) => void;
  onSortChange: (field: SortField, dir: SortDirection) => void;
  onClearFilters: () => void;
  onRefresh: () => void;
}

const inputSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "14px",
    bgcolor: "#fff",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    "&:hover .MuiOutlinedInput-notchedOutline": {
      borderColor: "#A7F3D0",
    },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
      borderColor: "#10B981",
    },
    "&.Mui-focused": {
      boxShadow: "0 0 0 3px rgba(16, 185, 129, 0.12)",
    },
  },
};

export default function PlaylistFiltersBar({
  search,
  statusFilter,
  sortField,
  sortDirection,
  resultCount,
  refreshing = false,
  onSearchChange,
  onStatusFilterChange,
  onSortChange,
  onClearFilters,
  onRefresh,
}: Props) {
  const sortValue = `${sortField}-${sortDirection}`;
  const isFiltered = hasActiveFilters(search, statusFilter);

  const handleSortChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [field, dir] = e.target.value.split("-") as [SortField, SortDirection];
    onSortChange(field, dir);
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, md: 2.5 },
        mb: 3,
        borderRadius: "20px",
        border: "1px solid #EEF2F7",
        bgcolor: "#FFFFFF",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 2,
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <FilterListRoundedIcon sx={{ color: "#10B981", fontSize: 20 }} />
          <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>
            Search & Filters
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography sx={{ color: "#94A3B8", fontSize: 13, fontWeight: 500, mr: 0.5 }}>
            {resultCount} playlist{resultCount !== 1 ? "s" : ""}
          </Typography>

          <Tooltip title="Refresh playlists">
            <IconButton
              size="small"
              onClick={onRefresh}
              disabled={refreshing}
              sx={{
                border: "1px solid #E5E7EB",
                borderRadius: "10px",
                animation: refreshing ? "spin 0.8s linear infinite" : "none",
                "@keyframes spin": {
                  from: { transform: "rotate(0deg)" },
                  to: { transform: "rotate(360deg)" },
                },
              }}
            >
              <RefreshRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Box
        sx={{
          display: "flex",
          gap: 2,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <TextField
          placeholder="Search by name…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          size="small"
          sx={{ flex: 1, minWidth: { xs: "100%", sm: 280 }, ...inputSx }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon sx={{ color: "#94A3B8", fontSize: 20 }} />
                </InputAdornment>
              ),
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => onSearchChange("")} edge="end">
                    <ClearRoundedIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </InputAdornment>
              ) : null,
            },
          }}
        />

        <TextField
          select
          label="Status"
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as StatusFilter)}
          size="small"
          sx={{ width: { xs: "100%", sm: 160 }, ...inputSx }}
        >
          <MenuItem value="All">All Statuses</MenuItem>
          <MenuItem value="Published">Published</MenuItem>
          <MenuItem value="Draft">Draft</MenuItem>
          <MenuItem value="Archived">Archived</MenuItem>
        </TextField>

        <TextField
          select
          label="Sort By"
          value={sortValue}
          onChange={handleSortChange}
          size="small"
          sx={{ width: { xs: "100%", sm: 180 }, ...inputSx }}
        >
          <MenuItem value="updatedAt-desc">Recently Updated</MenuItem>
          <MenuItem value="updatedAt-asc">Oldest Updated</MenuItem>
          <MenuItem value="name-asc">Name (A-Z)</MenuItem>
          <MenuItem value="name-desc">Name (Z-A)</MenuItem>
          <MenuItem value="totalDuration-desc">Duration (Longest)</MenuItem>
          <MenuItem value="totalDuration-asc">Duration (Shortest)</MenuItem>
        </TextField>

        {isFiltered && (
          <Button
            size="small"
            startIcon={<ClearRoundedIcon />}
            onClick={onClearFilters}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              borderRadius: "12px",
              color: "#64748B",
              border: "1px solid #E5E7EB",
              px: 2,
              height: 40,
            }}
          >
            Clear filters
          </Button>
        )}
      </Box>
    </Paper>
  );
}
