import { useEffect } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography } from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Device, DeviceOrientation } from "../../types/device";
import { ORIENTATION_LABELS } from "../../types/device";

const RESOLUTIONS = ["1920x1080", "3840x2160", "1280x720", "1080x1920", "2160x3840"];

const schema = z.object({
  id: z
    .string()
    .trim()
    .min(1, "Device ID is required")
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, hyphens and underscores only"),
  name: z.string().trim().min(1, "Name is required").max(80),
  location: z.string().trim().min(1, "Location is required").max(80),
  resolution: z.string().trim().min(1, "Resolution is required"),
  orientation: z.enum(["LANDSCAPE", "PORTRAIT_RIGHT", "PORTRAIT_LEFT", "UPSIDE_DOWN"]),
});

export type DeviceFormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  device?: Device | null;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (values: DeviceFormValues) => void;
}

function suggestId() {
  return `TV-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;
}

export default function DeviceFormDialog({ open, device, saving, onClose, onSubmit }: Props) {
  const isEdit = Boolean(device);
  const { control, handleSubmit, reset } = useForm<DeviceFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { id: "", name: "", location: "", resolution: RESOLUTIONS[0], orientation: "LANDSCAPE" },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      device
        ? { id: device.id, name: device.name, location: device.location, resolution: device.resolution, orientation: device.orientation ?? "LANDSCAPE" }
        : { id: suggestId(), name: "", location: "", resolution: RESOLUTIONS[0], orientation: "LANDSCAPE" },
    );
  }, [open, device, reset]);

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{isEdit ? "Edit device" : "Add device manually"}</DialogTitle>
      <DialogContent>
        {!isEdit && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Players normally register themselves when the app starts and appear in this list automatically. Add a device by hand only if you need a
            placeholder before the screen is installed.
          </Typography>
        )}
        <Box component="form" id="device-form" onSubmit={handleSubmit(onSubmit)} sx={{ display: "grid", gap: 2, pt: 0.5 }}>
          <Controller
            name="id"
            control={control}
            render={({ field, fieldState }) => (
              <TextField {...field} label="Device ID" disabled={isEdit || saving} error={!!fieldState.error} helperText={fieldState.error?.message} slotProps={{ input: { sx: { fontFamily: "ui-monospace, monospace" } } }} />
            )}
          />
          <Controller name="name" control={control} render={({ field, fieldState }) => <TextField {...field} label="Name" placeholder="Lobby display" autoFocus disabled={saving} error={!!fieldState.error} helperText={fieldState.error?.message} />} />
          <Controller name="location" control={control} render={({ field, fieldState }) => <TextField {...field} label="Location" placeholder="Reception, floor 2" disabled={saving} error={!!fieldState.error} helperText={fieldState.error?.message} />} />
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
            <Controller
              name="resolution"
              control={control}
              render={({ field, fieldState }) => (
                <TextField {...field} select label="Resolution" disabled={saving} error={!!fieldState.error} helperText={fieldState.error?.message}>
                  {[...new Set([...RESOLUTIONS, field.value].filter(Boolean))].map((r) => (
                    <MenuItem key={r} value={r}>
                      {r}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <Controller
              name="orientation"
              control={control}
              render={({ field }) => (
                <TextField {...field} select label="Orientation" disabled={saving}>
                  {(Object.keys(ORIENTATION_LABELS) as DeviceOrientation[]).map((o) => (
                    <MenuItem key={o} value={o}>
                      {ORIENTATION_LABELS[o]}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" form="device-form" variant="contained" disabled={saving}>
          {saving ? "Saving…" : isEdit ? "Save changes" : "Add device"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
