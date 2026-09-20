import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, ListItemIcon, Menu, MenuItem, TextField, Tooltip, Typography } from "@mui/material";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import KeyRoundedIcon from "@mui/icons-material/KeyRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import DevicesOtherRoundedIcon from "@mui/icons-material/DevicesOtherRounded";
import { useSnackbar } from "notistack";
import { useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { AuthService } from "../../services/AccountService";
import { PASSWORD_MIN_LENGTH } from "../../types/account";
import { MONO } from "../../app/theme";
import SessionsDialog from "./SessionsDialog";

function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const { enqueueSnackbar } = useSnackbar();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooShort = next.length > 0 && next.length < PASSWORD_MIN_LENGTH;
  const mismatch = again.length > 0 && again !== next;
  const ready = current && next.length >= PASSWORD_MIN_LENGTH && again === next;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await AuthService.changePassword(current, next);
      enqueueSnackbar("Password changed. Other devices were signed out.", { variant: "success" });
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <Box component="form" onSubmit={submit} noValidate>
        <DialogTitle>Change password</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, pt: "12px !important" }}>
          <TextField label="Current password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus fullWidth />
          <TextField
            label="New password"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            error={tooShort}
            helperText={tooShort ? `At least ${PASSWORD_MIN_LENGTH} characters.` : " "}
            fullWidth
          />
          <TextField
            label="New password again"
            type="password"
            autoComplete="new-password"
            value={again}
            onChange={(e) => setAgain(e.target.value)}
            error={mismatch}
            helperText={mismatch ? "The two do not match." : " "}
            fullWidth
          />
          {error && (
            <Typography role="alert" variant="body2" color="error">
              {error}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={!ready || busy}>
            {busy ? "Saving…" : "Change password"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

/** Who is signed in, with the two things they can do about it. Absent while the backend has no accounts. */
export default function AccountMenu() {
  const { user, logout } = useAuth();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [changing, setChanging] = useState(false);
  const [showingSessions, setShowingSessions] = useState(false);

  if (!user) return null;

  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <>
      <Tooltip title={`${user.name} · ${user.role === "admin" ? "Administrator" : (user.clientName ?? "Client")}`}>
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label="Account" aria-haspopup="menu" sx={{ ml: 0.25 }}>
          <Box
            sx={{
              width: 26,
              height: 26,
              display: "grid",
              placeItems: "center",
              bgcolor: "board.cell",
              border: 1,
              borderColor: "surface.borderStrong",
              fontFamily: MONO,
              fontSize: 10.5,
              fontWeight: 700,
              color: "text.primary",
            }}
          >
            {initials || <PersonOutlineRoundedIcon sx={{ fontSize: 16 }} />}
          </Box>
        </IconButton>
      </Tooltip>

      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
        <Box sx={{ px: 2, pt: 1, pb: 1.25, minWidth: 220, maxWidth: 300 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 13.5 }} noWrap>
            {user.name}
          </Typography>
          <Typography sx={{ fontFamily: MONO, fontSize: 11, color: "text.secondary" }} noWrap>
            {user.email}
          </Typography>
          <Typography sx={{ mt: 0.75, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.17em", textTransform: "uppercase", color: user.role === "admin" ? "primary.main" : "text.secondary" }}>
            {user.role === "admin" ? "Administrator" : (user.clientName ?? "Client")}
          </Typography>
        </Box>
        <Divider />
        <MenuItem
          onClick={() => {
            setAnchor(null);
            setChanging(true);
          }}
        >
          <ListItemIcon>
            <KeyRoundedIcon fontSize="small" />
          </ListItemIcon>
          Change password
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            setShowingSessions(true);
          }}
        >
          <ListItemIcon>
            <DevicesOtherRoundedIcon fontSize="small" />
          </ListItemIcon>
          Signed-in devices
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            void logout();
          }}
        >
          <ListItemIcon>
            <LogoutRoundedIcon fontSize="small" />
          </ListItemIcon>
          Sign out
        </MenuItem>
      </Menu>

      {changing && <ChangePasswordDialog onClose={() => setChanging(false)} />}
      {showingSessions && <SessionsDialog onClose={() => setShowingSessions(false)} />}
    </>
  );
}
