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

import type { LocationFilter, StatusFilter } from "./types";

interface Props {
  search: string;
  statusFilter: StatusFilter;
  locationFilter: LocationFilter;
  locations: string[];
  resultCount: number;
  hasActiveFilters: boolean;
  refreshing?: boolean;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: StatusFilter) => void;
  onLocationFilterChange: (value: LocationFilter) => void;
  onClearFilters: () => void;
  onRefresh: () => void;
}

const inputSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "14px",
    bgcolor: "#fff",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    "&:hover .MuiOutlinedInput-notchedOutline": {
      borderColor: "#C4B5FD",
    },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
      borderColor: "#6C4CF1",
    },
    "&.Mui-focused": {
      boxShadow: "0 0 0 3px rgba(108,76,241,0.12)",
    },
  },
};

export default function DeviceFiltersBar({
  search,
  statusFilter,
  locationFilter,
  locations,
  resultCount,
  hasActiveFilters,
  refreshing = false,
  onSearchChange,
  onStatusFilterChange,
  onLocationFilterChange,
  onClearFilters,
  onRefresh,
}: Props) {
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
          <FilterListRoundedIcon sx={{ color: "#6C4CF1", fontSize: 20 }} />
          <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>
            Search & Filters
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography sx={{ color: "#94A3B8", fontSize: 13, fontWeight: 500, mr: 0.5 }}>
            {resultCount} result{resultCount !== 1 ? "s" : ""}
          </Typography>

          <Tooltip title="Refresh devices">
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
          placeholder="Search by name, ID, or location…"
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
          <MenuItem value="Online">Online</MenuItem>
          <MenuItem value="Offline">Offline</MenuItem>
          <MenuItem value="Idle">Idle</MenuItem>
        </TextField>

        <TextField
          select
          label="Location"
          value={locationFilter}
          onChange={(e) => onLocationFilterChange(e.target.value as LocationFilter)}
          size="small"
          sx={{ width: { xs: "100%", sm: 180 }, ...inputSx }}
        >
          <MenuItem value="All">All Locations</MenuItem>
          {locations.map((loc) => (
            <MenuItem key={loc} value={loc}>
              {loc}
            </MenuItem>
          ))}
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
            Clear all
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
          {statusFilter !== "All" && (
            <Chip
              label={`Status: ${statusFilter}`}
              size="small"
              onDelete={() => onStatusFilterChange("All")}
              sx={{ borderRadius: "8px", fontWeight: 500 }}
            />
          )}
          {locationFilter !== "All" && (
            <Chip
              label={`Location: ${locationFilter}`}
              size="small"
              onDelete={() => onLocationFilterChange("All")}
              sx={{ borderRadius: "8px", fontWeight: 500 }}
            />
          )}
        </Box>
      )}
    </Paper>
  );
}
