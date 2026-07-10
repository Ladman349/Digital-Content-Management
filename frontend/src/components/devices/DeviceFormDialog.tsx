import { useEffect } from "react";

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";

import TvRoundedIcon from "@mui/icons-material/TvRounded";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import type { DeviceFormValues, DeviceStatus } from "./types";

const deviceSchema = z.object({
  id: z
    .string()
    .min(1, "Device ID is required")
    .regex(/^[A-Z0-9-]+$/i, "Use letters, numbers, and hyphens only"),
  name: z.string().min(1, "Device name is required").max(64),
  location: z.string().min(1, "Location is required").max(64),
  status: z.enum(["Online", "Offline", "Idle"]),
  resolution: z.string().min(1, "Resolution is required"),
  orientation: z.enum(["LANDSCAPE", "PORTRAIT_RIGHT", "PORTRAIT_LEFT", "UPSIDE_DOWN"]).default("LANDSCAPE"),
});

const inputSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "12px",
  },
};

interface Props {
  open: boolean;
  mode: "add" | "edit";
  initialValues?: DeviceFormValues;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: DeviceFormValues) => void;
}

const defaultValues: DeviceFormValues = {
  id: "",
  name: "",
  location: "",
  status: "Online",
  resolution: "1920 × 1080",
  orientation: "LANDSCAPE",
};

export default function DeviceFormDialog({
  open,
  mode,
  initialValues,
  loading = false,
  onClose,
  onSubmit,
}: Props) {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DeviceFormValues>({
    resolver: zodResolver(deviceSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) {
      reset(initialValues ?? defaultValues);
    }
  }, [open, initialValues, reset]);

  const title = mode === "add" ? "Add Device" : "Edit Device";
  const submitLabel = mode === "add" ? "Add Device" : "Save Changes";

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: "20px",
          },
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: "12px",
              bgcolor: "#EEF2FF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <TvRoundedIcon sx={{ color: "#6C4CF1" }} />
          </Box>

          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 20 }}>{title}</Typography>
            <Typography sx={{ color: "#64748B", fontSize: 13, mt: 0.25 }}>
              {mode === "add"
                ? "Register a new digital signage display"
                : "Update device configuration"}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box
          component="form"
          id="device-form"
          onSubmit={handleSubmit(onSubmit)}
          sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 1 }}
        >
          <Controller
            name="id"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Device ID"
                placeholder="TV-001"
                disabled={mode === "edit" || loading}
                error={!!errors.id}
                helperText={errors.id?.message}
                fullWidth
                sx={inputSx}
              />
            )}
          />

          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Device Name"
                placeholder="Lobby Display"
                disabled={loading}
                error={!!errors.name}
                helperText={errors.name?.message}
                fullWidth
                sx={inputSx}
              />
            )}
          />

          <Controller
            name="location"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Location"
                placeholder="Reception"
                disabled={loading}
                error={!!errors.location}
                helperText={errors.location?.message}
                fullWidth
                sx={inputSx}
              />
            )}
          />

          <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" } }}>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Status"
                  disabled={loading}
                  fullWidth
                  sx={inputSx}
                >
                  {(["Online", "Offline", "Idle"] as DeviceStatus[]).map((s) => (
                    <MenuItem key={s} value={s}>
                      {s}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <Controller
              name="resolution"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Resolution"
                  disabled={loading}
                  error={!!errors.resolution}
                  helperText={errors.resolution?.message}
                  fullWidth
                  sx={inputSx}
                >
                  <MenuItem value="1920 × 1080">1920 × 1080 (Full HD)</MenuItem>
                  <MenuItem value="3840 × 2160">3840 × 2160 (4K UHD)</MenuItem>
                  <MenuItem value="1280 × 720">1280 × 720 (HD)</MenuItem>
                </TextField>
              )}
            />
          </Box>

          <Controller
            name="orientation"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                select
                label="Display Orientation"
                disabled={loading}
                error={!!errors.orientation}
                helperText={errors.orientation?.message}
                fullWidth
                sx={inputSx}
              >
                <MenuItem value="LANDSCAPE">Landscape (0°)</MenuItem>
                <MenuItem value="PORTRAIT_RIGHT">Portrait Right (90°)</MenuItem>
                <MenuItem value="UPSIDE_DOWN">Upside Down (180°)</MenuItem>
                <MenuItem value="PORTRAIT_LEFT">Portrait Left (270°)</MenuItem>
              </TextField>
            )}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button
          onClick={onClose}
          disabled={loading}
          sx={{
            textTransform: "none",
            fontWeight: 600,
            borderRadius: "12px",
            px: 2.5,
            color: "#64748B",
          }}
        >
          Cancel
        </Button>

        <Button
          type="submit"
          form="device-form"
          variant="contained"
          disabled={loading}
          sx={{
            textTransform: "none",
            fontWeight: 700,
            borderRadius: "12px",
            px: 3,
            background: "linear-gradient(135deg,#6C4CF1,#8B5CF6)",
            boxShadow: "none",
            "&:hover": {
              background: "linear-gradient(135deg,#5B3DF5,#7C4DFF)",
            },
          }}
        >
          {loading ? "Saving…" : submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
