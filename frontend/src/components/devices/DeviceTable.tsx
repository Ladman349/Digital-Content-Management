import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";

import {
  Avatar,
  Box,
  Button,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";

import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import FilterListOffRoundedIcon from "@mui/icons-material/FilterListOffRounded";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import TvRoundedIcon from "@mui/icons-material/TvRounded";

import EmptyState from "../common/EmptyState";
import StatusChip, { statusToVariant } from "../common/StatusChip";
import type { Device, SortDirection, SortField } from "./types";
import { getRelativeTime, formatDateTime } from "../../utils/date";

interface Props {
  devices: Device[];
  totalCount: number;
  loading?: boolean;
  hasActiveFilters?: boolean;
  onEdit: (device: Device) => void;
  onDelete: (device: Device) => void;
  onAddDevice?: () => void;
  onClearFilters?: () => void;
  onCopyId?: (id: string) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
}

const SORT_COLUMNS: { id: SortField | null; label: string }[] = [
  { id: "name", label: "Device" },
  { id: "location", label: "Location" },
  { id: "status", label: "Status" },
  { id: null, label: "Resolution" },
  { id: "lastSeen", label: "Last Seen" },
  { id: null, label: "Actions" },
];

function DeviceAvatar({ name }: { name: string }) {
  const hue = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;

  return (
    <Avatar
      sx={{
        width: 42,
        height: 42,
        bgcolor: `hsl(${hue}, 65%, 95%)`,
        color: `hsl(${hue}, 55%, 45%)`,
        border: "1px solid",
        borderColor: `hsl(${hue}, 50%, 88%)`,
        transition: "transform 0.2s ease",
        ".MuiTableRow-root:hover &": { transform: "scale(1.05)" },
      }}
    >
      <TvRoundedIcon sx={{ fontSize: 22 }} />
    </Avatar>
  );
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell colSpan={6}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, py: 0.5 }}>
              <Skeleton variant="circular" width={42} height={42} />
              <Box sx={{ flex: 1 }}>
                <Skeleton width="30%" height={20} />
                <Skeleton width="20%" height={16} sx={{ mt: 0.5 }} />
              </Box>
              <Skeleton width={80} height={28} sx={{ borderRadius: "8px" }} />
            </Box>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

function DeviceMobileCard({
  device,
  onEdit,
  onDelete,
}: {
  device: Device;
  onEdit: (device: Device) => void;
  onDelete: (device: Device) => void;
}) {
  return (
    <Box
      sx={{
        p: 2.5,
        borderBottom: "1px solid #EEF2F7",
        transition: "background-color 0.2s ease, transform 0.2s ease",
        "&:hover": { bgcolor: "#FAFBFF" },
        "&:last-child": { borderBottom: "none" },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
        <DeviceAvatar name={device.name} />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{device.name}</Typography>
              <Typography sx={{ color: "#94A3B8", fontSize: 12, fontWeight: 500, mt: 0.25 }}>
                {device.id}
              </Typography>
            </Box>
            <StatusChip status={statusToVariant(device.status)} />
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 1.5 }}>
            <LocationOnOutlinedIcon sx={{ fontSize: 15, color: "#94A3B8" }} />
            <Typography sx={{ color: "#64748B", fontSize: 13 }}>{device.location}</Typography>
          </Box>

          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mt: 2,
            }}
          >
            <Box>
              <Typography sx={{ color: "#94A3B8", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
                Resolution
              </Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 600, mt: 0.25 }}>
                {device.resolution}
              </Typography>
            </Box>

            <Box sx={{ textAlign: "right" }}>
              <Typography sx={{ color: "#94A3B8", fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
                Last Seen
              </Typography>
              <Tooltip title={formatDateTime(device.lastSeenMs)} arrow>
                <Typography sx={{ fontSize: 13, color: "#64748B", mt: 0.25, cursor: "help", display: "inline-block", borderBottom: "1px dashed #CBD5E1" }}>
                  {getRelativeTime(device.lastSeenMs)}
                </Typography>
              </Tooltip>
            </Box>
          </Box>

          <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<EditOutlinedIcon sx={{ fontSize: 16 }} />}
              onClick={() => onEdit(device)}
              sx={{
                flex: 1,
                textTransform: "none",
                borderRadius: "10px",
                fontWeight: 600,
                borderColor: "#E5E7EB",
                color: "#374151",
              }}
            >
              Edit
            </Button>

            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />}
              onClick={() => onDelete(device)}
              sx={{
                flex: 1,
                textTransform: "none",
                borderRadius: "10px",
                fontWeight: 600,
              }}
            >
              Delete
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function RowActions({
  device,
  onEdit,
  onDelete,
  onCopyId,
}: {
  device: Device;
  onEdit: (device: Device) => void;
  onDelete: (device: Device) => void;
  onCopyId?: (id: string) => void;
}) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  return (
    <>
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 0.5,
          opacity: 0.7,
          transition: "opacity 0.2s ease",
          ".MuiTableRow-root:hover &": { opacity: 1 },
        }}
      >
        <Tooltip title="Edit device">
          <IconButton
            size="small"
            onClick={() => onEdit(device)}
            sx={{
              borderRadius: "10px",
              border: "1px solid #E5E7EB",
              "&:hover": { bgcolor: "#EEF2FF", borderColor: "#C4B5FD" },
            }}
          >
            <EditOutlinedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Delete device">
          <IconButton
            size="small"
            onClick={() => onDelete(device)}
            sx={{
              borderRadius: "10px",
              border: "1px solid #E5E7EB",
              color: "#EF4444",
              "&:hover": { bgcolor: "#FEF2F2", borderColor: "#FECACA" },
            }}
          >
            <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>

        <Tooltip title="More options">
          <IconButton
            size="small"
            onClick={(e) => setAnchorEl(e.currentTarget)}
            sx={{
              borderRadius: "10px",
              border: "1px solid #E5E7EB",
              "&:hover": { bgcolor: "#F8FAFC" },
            }}
          >
            <MoreHorizRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        slotProps={{
          paper: {
            sx: {
              borderRadius: "12px",
              border: "1px solid #EEF2F7",
              boxShadow: "0 12px 40px rgba(15,23,42,0.12)",
              minWidth: 180,
            },
          },
        }}
      >
        <MenuItem
          onClick={() => {
            onCopyId?.(device.id);
            setAnchorEl(null);
          }}
        >
          <ListItemIcon>
            <ContentCopyRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Copy device ID</ListItemText>
        </MenuItem>

        <MenuItem
          onClick={() => {
            onEdit(device);
            setAnchorEl(null);
          }}
        >
          <ListItemIcon>
            <EditOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit device</ListItemText>
        </MenuItem>

        <MenuItem
          onClick={() => {
            onDelete(device);
            setAnchorEl(null);
          }}
          sx={{ color: "#EF4444" }}
        >
          <ListItemIcon>
            <DeleteOutlineRoundedIcon fontSize="small" sx={{ color: "#EF4444" }} />
          </ListItemIcon>
          <ListItemText>Delete device</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}

export default function DeviceTable({
  devices,
  totalCount,
  loading = false,
  hasActiveFilters = false,
  onEdit,
  onDelete,
  onAddDevice,
  onClearFilters,
  onCopyId,
  sortField,
  sortDirection,
  onSort,
}: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  useEffect(() => {
    setPage(0);
  }, [devices.length, sortField, sortDirection]);

  const paginatedDevices = useMemo(() => {
    const start = page * rowsPerPage;
    return devices.slice(start, start + rowsPerPage);
  }, [devices, page, rowsPerPage]);

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const emptyTitle = hasActiveFilters ? "No matching devices" : "No devices yet";
  const emptyDescription = hasActiveFilters
    ? "No devices match your current search or filters. Try adjusting your criteria."
    : "Get started by adding your first digital signage display to the network.";
  const emptyAction = hasActiveFilters ? onClearFilters : onAddDevice;
  const emptyActionLabel = hasActiveFilters ? "Clear filters" : "Add Device";
  const EmptyIcon = hasActiveFilters ? FilterListOffRoundedIcon : TvRoundedIcon;

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: "20px",
        border: "1px solid #EEF2F7",
        overflow: "hidden",
        bgcolor: "#FFFFFF",
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          px: 3,
          py: 2.5,
          borderBottom: "1px solid #EEF2F7",
        }}
      >
        <Typography sx={{ fontWeight: 700, fontSize: 16, color: "#111827" }}>
          All Devices
        </Typography>

        {!loading && totalCount > 0 && (
          <Typography sx={{ color: "#94A3B8", fontSize: 13, fontWeight: 500 }}>
            Showing {devices.length} of {totalCount}
          </Typography>
        )}
      </Box>

      {loading ? (
        isMobile ? (
          <Box>
            {Array.from({ length: 4 }).map((_, i) => (
              <Box key={i} sx={{ p: 2.5, borderBottom: "1px solid #EEF2F7" }}>
                <Box sx={{ display: "flex", gap: 2 }}>
                  <Skeleton variant="circular" width={42} height={42} />
                  <Box sx={{ flex: 1 }}>
                    <Skeleton width="60%" height={20} />
                    <Skeleton width="40%" height={16} sx={{ mt: 0.5 }} />
                    <Skeleton width="80%" height={16} sx={{ mt: 1.5 }} />
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  {SORT_COLUMNS.map((col) => (
                    <TableCell
                      key={col.label}
                      sx={{
                        fontWeight: 700,
                        color: "#64748B",
                        fontSize: 12,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        bgcolor: "#F8FAFC",
                        borderBottom: "1px solid #EEF2F7",
                        py: 1.75,
                      }}
                    >
                      {col.label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                <TableSkeleton />
              </TableBody>
            </Table>
          </TableContainer>
        )
      ) : devices.length === 0 ? (
        <EmptyState
          icon={EmptyIcon}
          title={emptyTitle}
          description={emptyDescription}
          actionLabel={emptyAction ? emptyActionLabel : undefined}
          onAction={emptyAction}
        />
      ) : isMobile ? (
        <>
          <Box>
            {paginatedDevices.map((device) => (
              <DeviceMobileCard
                key={device.id}
                device={device}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </Box>
          <TablePagination
            component="div"
            count={devices.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25]}
            sx={{ borderTop: "1px solid #EEF2F7" }}
          />
        </>
      ) : (
        <>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  {SORT_COLUMNS.map((col) => (
                    <TableCell
                      key={col.label}
                      align={col.label === "Actions" ? "right" : "left"}
                      sortDirection={col.id === sortField ? sortDirection : false}
                      sx={{
                        fontWeight: 700,
                        color: "#64748B",
                        fontSize: 12,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        bgcolor: "#F8FAFC",
                        borderBottom: "1px solid #EEF2F7",
                        py: 1.75,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {col.id ? (
                        <TableSortLabel
                          active={sortField === col.id}
                          direction={sortField === col.id ? sortDirection : "asc"}
                          onClick={() => onSort(col.id!)}
                          sx={{
                            "& .MuiTableSortLabel-icon": { color: "#6C4CF1 !important" },
                          }}
                        >
                          {col.label}
                        </TableSortLabel>
                      ) : (
                        col.label
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>

              <TableBody>
                {paginatedDevices.map((device) => (
                  <TableRow
                    key={device.id}
                    hover
                    sx={{
                      transition: "background-color 0.2s ease",
                      "&:hover": { bgcolor: "#FAFBFF" },
                      "&:last-child td": { borderBottom: 0 },
                    }}
                  >
                    <TableCell sx={{ py: 2 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <DeviceAvatar name={device.name} />

                        <Box>
                          <Typography sx={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>
                            {device.name}
                          </Typography>
                          <Typography
                            sx={{
                              color: "#94A3B8",
                              fontSize: 12,
                              fontWeight: 500,
                              mt: 0.25,
                              fontFamily: "monospace",
                            }}
                          >
                            {device.id}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>

                    <TableCell sx={{ py: 2 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                        <LocationOnOutlinedIcon sx={{ fontSize: 16, color: "#94A3B8" }} />
                        <Typography sx={{ color: "#64748B", fontSize: 14 }}>
                          {device.location}
                        </Typography>
                      </Box>
                    </TableCell>

                    <TableCell sx={{ py: 2 }}>
                      <StatusChip status={statusToVariant(device.status)} />
                    </TableCell>

                    <TableCell sx={{ py: 2 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 500, color: "#374151" }}>
                        {device.resolution}
                      </Typography>
                      {device.orientation && device.orientation !== "LANDSCAPE" && (
                        <Typography sx={{ color: "#64748B", fontSize: 12, mt: 0.5 }}>
                          {device.orientation === "PORTRAIT_RIGHT" && "Portrait Right"}
                          {device.orientation === "PORTRAIT_LEFT" && "Portrait Left"}
                          {device.orientation === "UPSIDE_DOWN" && "Upside Down"}
                        </Typography>
                      )}
                    </TableCell>

                    <TableCell sx={{ py: 2 }}>
                      <Tooltip title={formatDateTime(device.lastSeenMs)} arrow>
                        <Typography sx={{ color: "#64748B", fontSize: 14, display: "inline-block", cursor: "help", borderBottom: "1px dashed #CBD5E1" }}>
                          {getRelativeTime(device.lastSeenMs)}
                        </Typography>
                      </Tooltip>
                    </TableCell>

                    <TableCell align="right" sx={{ py: 2 }}>
                      <RowActions
                        device={device}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onCopyId={onCopyId}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={devices.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25]}
            sx={{ borderTop: "1px solid #EEF2F7" }}
          />
        </>
      )}
    </Paper>
  );
}
