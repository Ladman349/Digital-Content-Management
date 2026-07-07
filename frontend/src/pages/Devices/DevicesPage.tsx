import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Box } from "@mui/material";
import { useSnackbar } from "notistack";

import DevicePageHero from "../../components/devices/DevicePageHero";
import DeviceStatsRow from "../../components/devices/DeviceStatsRow";
import DeviceFiltersBar from "../../components/devices/DeviceFiltersBar";
import DeviceTable from "../../components/devices/DeviceTable";
import DeviceFormDialog from "../../components/devices/DeviceFormDialog";
import ConfirmDialog from "../../components/common/ConfirmDialog";

import { DeviceService } from "../../services/DeviceService";
import { exportDevicesCsv, hasActiveFilters, sortDevices } from "../../components/devices/utils";

import type { Device } from "../../types/device";
import type { DeviceFormValues, LocationFilter, SortDirection, SortField, StatusFilter } from "../../components/devices/types";

export default function DevicesPage() {
  const { enqueueSnackbar } = useSnackbar();

  // ── Device data ──────────────────────────────────────────────────────────
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Router state ─────────────────────────────────────────────────────────
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.state?.openCreateDialog) {
      setFormMode("add");
      setFormInitial(undefined);
      setFormOpen(true);
      
      // Clear the state so refreshing doesn't reopen the dialog
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const data = await DeviceService.getDevices();
      setDevices(data);
    } catch (error) {
      enqueueSnackbar("Failed to load devices", { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  // ── Filter state ─────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("All");

  // ── Sort state ───────────────────────────────────────────────────────────
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // ── Form dialog state ────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [formInitial, setFormInitial] = useState<DeviceFormValues | undefined>(undefined);

  // ── Delete dialog state ──────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<Device | null>(null);

  // ── Derived data ─────────────────────────────────────────────────────────
  const onlineCount = useMemo(() => devices.filter((d) => d.status === "Online").length, [devices]);
  const offlineCount = useMemo(() => devices.filter((d) => d.status === "Offline").length, [devices]);
  const uniqueLocations = useMemo(() => [...new Set(devices.map((d) => d.location))].sort(), [devices]);

  const filtersActive = hasActiveFilters(search, statusFilter, locationFilter);

  const filteredDevices = useMemo(() => {
    let result = devices;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((d) => d.name.toLowerCase().includes(q) || d.id.toLowerCase().includes(q) || d.location.toLowerCase().includes(q));
    }

    if (statusFilter !== "All") result = result.filter((d) => d.status === statusFilter);
    if (locationFilter !== "All") result = result.filter((d) => d.location === locationFilter);

    return sortDevices(result, sortField, sortDirection);
  }, [devices, search, statusFilter, locationFilter, sortField, sortDirection]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSort = useCallback((field: SortField) => {
    setSortDirection((prev) => (sortField === field ? (prev === "asc" ? "desc" : "asc") : "asc"));
    setSortField(field);
  }, [sortField]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDevices();
    setRefreshing(false);
    enqueueSnackbar("Devices refreshed", { variant: "success" });
  }, [enqueueSnackbar]);

  const handleExport = useCallback(() => {
    exportDevicesCsv(filteredDevices);
    enqueueSnackbar("Devices exported to CSV", { variant: "success" });
  }, [filteredDevices, enqueueSnackbar]);

  const handleClearFilters = useCallback(() => {
    setSearch("");
    setStatusFilter("All");
    setLocationFilter("All");
  }, []);

  const handleStatClick = useCallback((filter: StatusFilter) => {
    setStatusFilter(filter);
    setLocationFilter("All");
    setSearch("");
  }, []);

  const handleCopyId = useCallback((id: string) => {
    navigator.clipboard.writeText(id);
    enqueueSnackbar("Device ID copied to clipboard", { variant: "info" });
  }, [enqueueSnackbar]);

  // ── Add / Edit ───────────────────────────────────────────────────────────
  const handleAddDevice = useCallback(() => {
    setFormMode("add");
    setFormInitial(undefined);
    setFormOpen(true);
  }, []);

  const handleEditDevice = useCallback((device: Device) => {
    setFormMode("edit");
    setFormInitial({ id: device.id, name: device.name, location: device.location, status: device.status, resolution: device.resolution });
    setFormOpen(true);
  }, []);

  const handleFormSubmit = useCallback(async (values: DeviceFormValues) => {
    try {
      if (formMode === "add") {
        const newDevice = await DeviceService.createDevice({
          ...values,
          lastSeen: "Just now",
          lastSeenMs: Date.now(),
        });
        setDevices((prev) => [newDevice, ...prev]);
        enqueueSnackbar(`Device "${values.name}" added`, { variant: "success" });
      } else {
        const updatedDevice = await DeviceService.updateDevice(values.id!, values);
        setDevices((prev) => prev.map((d) => (d.id === updatedDevice.id ? updatedDevice : d)));
        enqueueSnackbar(`Device "${values.name}" updated`, { variant: "success" });
      }
      setFormOpen(false);
    } catch (err: any) {
      enqueueSnackbar(err.message || "Failed to save device", { variant: "error" });
    }
  }, [formMode, enqueueSnackbar]);

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDeleteDevice = useCallback((device: Device) => {
    setDeleteTarget(device);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await DeviceService.deleteDevice(deleteTarget.id);
      setDevices((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      enqueueSnackbar(`Device "${deleteTarget.name}" deleted`, { variant: "success" });
    } catch (err: any) {
      enqueueSnackbar(err.message || "Failed to delete device", { variant: "error" });
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, enqueueSnackbar]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Box>
      <DevicePageHero totalDevices={devices.length} onlineCount={onlineCount} onAddDevice={handleAddDevice} onExport={handleExport} onRefresh={handleRefresh} refreshing={refreshing} />
      <DeviceStatsRow total={devices.length} online={onlineCount} offline={offlineCount} locations={uniqueLocations.length} onStatClick={handleStatClick} loading={loading} />
      <DeviceFiltersBar search={search} statusFilter={statusFilter} locationFilter={locationFilter} locations={uniqueLocations} resultCount={filteredDevices.length} hasActiveFilters={filtersActive} refreshing={refreshing} onSearchChange={setSearch} onStatusFilterChange={setStatusFilter} onLocationFilterChange={setLocationFilter} onClearFilters={handleClearFilters} onRefresh={handleRefresh} />
      <DeviceTable devices={filteredDevices} totalCount={devices.length} hasActiveFilters={filtersActive} onEdit={handleEditDevice} onDelete={handleDeleteDevice} onAddDevice={handleAddDevice} onClearFilters={handleClearFilters} onCopyId={handleCopyId} sortField={sortField} sortDirection={sortDirection} onSort={handleSort} loading={loading} />
      <DeviceFormDialog open={formOpen} mode={formMode} initialValues={formInitial} onClose={() => setFormOpen(false)} onSubmit={handleFormSubmit} />
      <ConfirmDialog open={!!deleteTarget} title="Delete Device" message={deleteTarget ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone and the device will need to be re-registered.` : ""} onConfirm={handleConfirmDelete} onClose={() => setDeleteTarget(null)} />
    </Box>
  );
}