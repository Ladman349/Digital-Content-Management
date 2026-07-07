import {
  Box,
  Button,
  Chip,
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

import type { TypeFilter, CategoryFilter, SortField, SortDirection } from "./types";

interface Props {
  search: string;
  typeFilter: TypeFilter;
  categoryFilter: CategoryFilter;
  sortField: SortField;
  sortDirection: SortDirection;
  resultCount: number;
  hasActiveFilters: boolean;
  refreshing?: boolean;
  onSearchChange: (value: string) => void;
  onTypeFilterChange: (value: TypeFilter) => void;
  onCategoryFilterChange: (value: CategoryFilter) => void;
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
      borderColor: "#BAE6FD",
    },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
      borderColor: "#0EA5E9",
    },
    "&.Mui-focused": {
      boxShadow: "0 0 0 3px rgba(14, 165, 233, 0.12)",
    },
  },
};

export default function MediaFiltersBar({
  search,
  typeFilter,
  categoryFilter,
  sortField,
  sortDirection,
  resultCount,
  hasActiveFilters,
  refreshing = false,
  onSearchChange,
  onTypeFilterChange,
  onCategoryFilterChange,
  onSortChange,
  onClearFilters,
  onRefresh,
}: Props) {
  const sortValue = `${sortField}-${sortDirection}`;

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
          <FilterListRoundedIcon sx={{ color: "#0EA5E9", fontSize: 20 }} />
          <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>
            Search & Filters
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography sx={{ color: "#94A3B8", fontSize: 13, fontWeight: 500, mr: 0.5 }}>
            {resultCount} result{resultCount !== 1 ? "s" : ""}
          </Typography>

          <Tooltip title="Refresh media">
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
          sx={{ flex: 1, minWidth: { xs: "100%", sm: 200 }, ...inputSx }}
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
          label="Media Type"
          value={typeFilter}
          onChange={(e) => onTypeFilterChange(e.target.value as TypeFilter)}
          size="small"
          sx={{ width: { xs: "48%", sm: 140 }, ...inputSx }}
        >
          <MenuItem value="All">All Types</MenuItem>
          <MenuItem value="Image">Images</MenuItem>
          <MenuItem value="Video">Videos</MenuItem>
        </TextField>

        <TextField
          select
          label="Category"
          value={categoryFilter}
          onChange={(e) => onCategoryFilterChange(e.target.value as CategoryFilter)}
          size="small"
          sx={{ width: { xs: "48%", sm: 160 }, ...inputSx }}
        >
          <MenuItem value="All">All Categories</MenuItem>
          <MenuItem value="Advertisement">Advertisement</MenuItem>
          <MenuItem value="Promotion">Promotion</MenuItem>
          <MenuItem value="Branding">Branding</MenuItem>
          <MenuItem value="Announcement">Announcement</MenuItem>
          <MenuItem value="Emergency">Emergency</MenuItem>
        </TextField>

        <TextField
          select
          label="Sort By"
          value={sortValue}
          onChange={handleSortChange}
          size="small"
          sx={{ width: { xs: "100%", sm: 170 }, ...inputSx }}
        >
          <MenuItem value="uploadedAt-desc">Newest First</MenuItem>
          <MenuItem value="uploadedAt-asc">Oldest First</MenuItem>
          <MenuItem value="name-asc">Name (A-Z)</MenuItem>
          <MenuItem value="name-desc">Name (Z-A)</MenuItem>
          <MenuItem value="size-desc">Size (Largest)</MenuItem>
          <MenuItem value="size-asc">Size (Smallest)</MenuItem>
        </TextField>

        {hasActiveFilters && (
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

      {hasActiveFilters && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 2 }}>
          {search.trim() && (
            <Chip
              label={`Search: "${search.trim()}"`}
              size="small"
              onDelete={() => onSearchChange("")}
              sx={{ borderRadius: "8px", fontWeight: 500 }}
            />
          )}
          {typeFilter !== "All" && (
            <Chip
              label={`Type: ${typeFilter}`}
              size="small"
              onDelete={() => onTypeFilterChange("All")}
              sx={{ borderRadius: "8px", fontWeight: 500 }}
            />
          )}
          {categoryFilter !== "All" && (
            <Chip
              label={`Category: ${categoryFilter}`}
              size="small"
              onDelete={() => onCategoryFilterChange("All")}
              sx={{ borderRadius: "8px", fontWeight: 500 }}
            />
          )}
        </Box>
      )}
    </Paper>
  );
}
