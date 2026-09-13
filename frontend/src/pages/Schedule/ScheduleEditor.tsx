import { useMemo, useState } from "react";
import { Alert, AlertTitle, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, TextField, Typography } from "@mui/material";
import { useSnackbar } from "notistack";
import type { Device } from "../../types/device";
import type { Playlist } from "../../types/playlist";
import type { Schedule, SchedulePriority, ScheduleRepeat, ScheduleStatus } from "../../types/schedule";
import { SCHEDULE_PRIORITIES, SCHEDULE_REPEATS } from "../../types/schedule";
import StatusDot from "../../components/ui/StatusDot";
import { deviceTone } from "../../components/ui/tone";
import { findConflicts, PRIORITY_WEIGHT } from "../../utils/schedule";
import { minutesOfDay, todayISO } from "../../utils/format";
import { useIsPhone } from "../../hooks/useIsPhone";

export interface ScheduleFormValues {
  name: string;
  playlistId: string;
  deviceIds: string[];
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  repeat: ScheduleRepeat;
  priority: SchedulePriority;
  status: ScheduleStatus;
}

interface Props {
  schedule?: Schedule | null;
  duplicateOf?: Schedule | null;
  playlists: Playlist[];
  devices: Device[];
  allSchedules: Schedule[];
  saving?: boolean;
  onClose: () => void;
  onSave: (values: ScheduleFormValues) => void;
}

const empty: ScheduleFormValues = {
  name: "",
  playlistId: "",
  deviceIds: [],
  startDate: todayISO(),
  endDate: todayISO(),
  startTime: "09:00",
  endTime: "17:00",
  repeat: "Daily",
  priority: "Normal",
  status: "Active",
};

/** Mounted by the parent only while open, so the form always starts from the given schedule. */
function initialForm(schedule?: Schedule | null, duplicateOf?: Schedule | null): ScheduleFormValues {
  const source = schedule ?? duplicateOf;
  if (!source) return empty;
  return {
    name: duplicateOf ? `${source.name} (copy)` : source.name,
    playlistId: source.playlistId,
    deviceIds: [...source.deviceIds],
    startDate: source.startDate,
    endDate: source.endDate,
    startTime: source.startTime,
    endTime: source.endTime,
    repeat: source.repeat,
    priority: source.priority,
    status: duplicateOf ? "Draft" : source.status,
  };
}

export default function ScheduleEditor({ schedule, duplicateOf, playlists, devices, allSchedules, saving, onClose, onSave }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const isPhone = useIsPhone();
  const [form, setForm] = useState<ScheduleFormValues>(() => initialForm(schedule, duplicateOf));

  const set = <K extends keyof ScheduleFormValues>(key: K, value: ScheduleFormValues[K]) => setForm((f) => ({ ...f, [key]: value }));

  const publishable = useMemo(() => playlists.filter((p) => p.status === "Published"), [playlists]);

  const conflicts = useMemo(
    () => findConflicts(allSchedules, { ...form, id: schedule?.id ?? "__new__" } as Schedule),
    [allSchedules, form, schedule],
  );

  const blocking = conflicts.filter((c) => PRIORITY_WEIGHT[form.priority] <= PRIORITY_WEIGHT[c.priority]);

  const timeInvalid = Boolean(form.startTime && form.endTime && minutesOfDay(form.startTime) >= minutesOfDay(form.endTime));
  const dateInvalid = Boolean(form.startDate && form.endDate && form.startDate > form.endDate);

  const submit = () => {
    if (!form.name.trim()) return enqueueSnackbar("Give the schedule a name", { variant: "error" });
    if (!form.playlistId) return enqueueSnackbar("Choose a published playlist", { variant: "error" });
    if (form.deviceIds.length === 0) return enqueueSnackbar("Choose at least one screen", { variant: "error" });
    if (dateInvalid) return enqueueSnackbar("The end date is before the start date", { variant: "error" });
    if (timeInvalid) return enqueueSnackbar("The end time must be after the start time; overnight windows are not supported", { variant: "error" });
    onSave({ ...form, name: form.name.trim() });
  };

  const toggleDevice = (id: string, checked: boolean) => set("deviceIds", checked ? [...form.deviceIds, id] : form.deviceIds.filter((d) => d !== id));
  const allSelected = devices.length > 0 && form.deviceIds.length === devices.length;

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="md" fullWidth fullScreen={isPhone}>
      <DialogTitle>{schedule ? "Edit schedule" : duplicateOf ? "Duplicate schedule" : "New schedule"}</DialogTitle>
      <DialogContent dividers>
        {publishable.length === 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            No published playlists. Publish a playlist before scheduling it.
          </Alert>
        )}
        {conflicts.length > 0 && (
          <Alert severity={blocking.length ? "error" : "info"} sx={{ mb: 2 }}>
            <AlertTitle sx={{ fontSize: 13, fontWeight: 700 }}>{blocking.length ? "The server will reject this" : "Overlaps an existing schedule"}</AlertTitle>
            <Typography variant="body2">
              {conflicts.map((c) => `“${c.name}” (${c.startTime}–${c.endTime}, ${c.priority})`).join(", ")} target the same screens in the same window.
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {blocking.length ? `Raise this schedule's priority above ${blocking.map((c) => c.priority).join("/")} or change the time window.` : "Your higher priority wins during the overlap."}
            </Typography>
          </Alert>
        )}

        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
          <TextField label="Schedule name" value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus required sx={{ gridColumn: { md: "1 / -1" } }} />

          <TextField select label="Playlist" value={form.playlistId} onChange={(e) => set("playlistId", e.target.value)} required helperText="Only published playlists can be scheduled">
            <MenuItem value="">
              <em>Select a playlist</em>
            </MenuItem>
            {publishable.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name} · {p.items.length} items
              </MenuItem>
            ))}
          </TextField>

          <TextField select label="Status" value={form.status} onChange={(e) => set("status", e.target.value as ScheduleStatus)} helperText="Only Active schedules play">
            <MenuItem value="Active">Active</MenuItem>
            <MenuItem value="Draft">Draft</MenuItem>
            <MenuItem value="Paused">Paused</MenuItem>
          </TextField>

          <TextField type="date" label="Start date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} slotProps={{ inputLabel: { shrink: true } }} error={dateInvalid} />
          <TextField type="date" label="End date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} slotProps={{ inputLabel: { shrink: true } }} error={dateInvalid} helperText={dateInvalid ? "End date is before the start date" : " "} />

          <TextField type="time" label="Start time" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} slotProps={{ inputLabel: { shrink: true } }} error={timeInvalid} />
          <TextField
            type="time"
            label="End time"
            value={form.endTime}
            onChange={(e) => set("endTime", e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            error={timeInvalid}
            helperText={timeInvalid ? "Must be after the start time; overnight windows are not supported" : " "}
          />

          <TextField select label="Repeat" value={form.repeat} onChange={(e) => set("repeat", e.target.value as ScheduleRepeat)}>
            {SCHEDULE_REPEATS.map((r) => (
              <MenuItem key={r} value={r}>
                {r}
              </MenuItem>
            ))}
          </TextField>

          <TextField select label="Priority" value={form.priority} onChange={(e) => set("priority", e.target.value as SchedulePriority)} helperText="Higher priority wins when windows overlap">
            {SCHEDULE_PRIORITIES.map((p) => (
              <MenuItem key={p} value={p}>
                {p}
              </MenuItem>
            ))}
          </TextField>

          <Box sx={{ gridColumn: { md: "1 / -1" } }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Screens ({form.deviceIds.length} selected)
              </Typography>
              <Button size="small" onClick={() => set("deviceIds", allSelected ? [] : devices.map((d) => d.id))}>
                {allSelected ? "Clear all" : "Select all"}
              </Button>
            </Box>
            <Box sx={{ border: 1, borderColor: "surface.border", borderRadius: 1.5, p: 1, maxHeight: 200, overflowY: "auto", display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" } }}>
              {devices.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                  No devices registered.
                </Typography>
              )}
              {devices.map((d) => (
                <FormControlLabel
                  key={d.id}
                  sx={{ m: 0 }}
                  control={<Checkbox size="small" checked={form.deviceIds.includes(d.id)} onChange={(e) => toggleDevice(d.id, e.target.checked)} />}
                  label={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                      <StatusDot tone={deviceTone(d.status)} size={7} />
                      <Typography sx={{ fontSize: 13 }}>{d.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {d.location}
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </Box>
            {form.deviceIds.some((id) => devices.find((d) => d.id === id)?.status === "Offline") && (
              <Typography variant="caption" color="warning.main" sx={{ display: "block", mt: 0.5 }}>
                Some selected screens are offline. They will pick up this schedule when they reconnect.
              </Typography>
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Typography variant="caption" color="text.secondary" sx={{ mr: "auto", flexBasis: { xs: "100%", sm: "auto" } }}>
          Times are evaluated by the server in India Standard Time.
        </Typography>
        <Button variant="outlined" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} disabled={saving}>
          {saving ? "Saving…" : schedule ? "Save changes" : "Create schedule"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

