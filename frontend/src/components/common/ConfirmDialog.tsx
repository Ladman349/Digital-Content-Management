import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  loading = false,
  onConfirm,
  onClose,
}: Props) {
  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: "20px",
            p: 1,
          },
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 700, fontSize: 20, pb: 1 }}>
        {title}
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: "12px",
              bgcolor: "#FEF2F2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <WarningAmberRoundedIcon sx={{ color: "#EF4444" }} />
          </Box>

          <Typography sx={{ color: "#64748B", lineHeight: 1.6, pt: 0.5 }}>
            {message}
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
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
          {cancelLabel}
        </Button>

        <Button
          variant="contained"
          color="error"
          onClick={onConfirm}
          disabled={loading}
          sx={{
            textTransform: "none",
            fontWeight: 700,
            borderRadius: "12px",
            px: 2.5,
            boxShadow: "none",
          }}
        >
          {loading ? "Deleting…" : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
