import { Box, Button, IconButton, InputAdornment, TextField, Tooltip, Typography } from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import { useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { useThemeMode } from "../../app/ThemeModeProvider";
import { useNow } from "../../hooks/useNow";
import { MONO } from "../../app/theme";
import { API_ROOT } from "../../api/client";

/** What is behind the gate, written the way the board itself would list it. */
const LINES = [
  { code: "NOW", text: "What every screen is showing" },
  { code: "SCR", text: "Screens, online and off" },
  { code: "MED", text: "Images and video" },
  { code: "PLY", text: "Playlists and schedules" },
];

function SlatMark({ size = 40 }: { size?: number }) {
  return (
    <Box component="svg" viewBox="0 0 32 32" aria-hidden sx={{ width: size, height: size, display: "block", flex: "none" }}>
      <rect width="32" height="32" rx="4" fill="#0B0B0C" />
      <rect x="5" y="7" width="22" height="5" fill="#F2C230" />
      <rect x="5" y="14" width="22" height="5" fill="#3E3E43" />
      <rect x="5" y="21" width="14" height="5" fill="#3E3E43" />
    </Box>
  );
}

function BoardClock() {
  const now = useNow(1_000);
  const d = new Date(now);
  return (
    <Typography
      component="time"
      dateTime={d.toISOString()}
      sx={{ fontFamily: MONO, fontWeight: 700, fontSize: { xs: 28, md: 44 }, letterSpacing: "0.06em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}
    >
      {d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
    </Typography>
  );
}

/**
 * The gate. Same two registers as the rest of the CMS: the board on the left says where you are, the
 * bench on the right is where the work (here, two fields) happens. On a phone the board shrinks to a
 * header so the form is reachable without scrolling and sits above the keyboard.
 */
export default function LoginPage({ unreachable = false, onRetry }: { unreachable?: boolean; onRetry?: () => void }) {
  const { login } = useAuth();
  const { mode, toggle } = useThemeMode();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError((err as Error).message || "Could not sign in.");
      setBusy(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        bgcolor: "background.default",
        display: "grid",
        gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1.15fr) minmax(360px, 0.85fr)" },
        gridTemplateRows: { xs: "auto 1fr", md: "1fr" },
        pt: "env(safe-area-inset-top)",
        pb: "env(safe-area-inset-bottom)",
      }}
    >
      {/* ── Board ─────────────────────────────────────────────────────────── */}
      <Box
        component="section"
        aria-label="Signage CMS"
        sx={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: { xs: 2, md: 4 }, px: { xs: 2.5, md: 6 }, py: { xs: 2.5, md: 6 }, minWidth: 0 }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <SlatMark size={36} />
          <Typography variant="h1" component="div" sx={{ color: "primary.main" }}>
            Signage CMS
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Tooltip title={mode === "light" ? "Switch to dark" : "Switch to light"}>
            <IconButton onClick={toggle} aria-label="Toggle theme">
              {mode === "light" ? <DarkModeRoundedIcon sx={{ fontSize: 19 }} /> : <LightModeRoundedIcon sx={{ fontSize: 19 }} />}
            </IconButton>
          </Tooltip>
        </Box>

        <Box sx={{ display: { xs: "none", md: "block" } }}>
          <Typography component="p" sx={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.19em", textTransform: "uppercase", color: "text.secondary", mb: 1 }}>
            Local time
          </Typography>
          <BoardClock />

          <Box component="ul" sx={{ listStyle: "none", p: 0, m: 0, mt: 5, display: "grid", gap: "2px" }}>
            {LINES.map((line, i) => (
              <Box
                component="li"
                key={line.code}
                sx={{ display: "flex", alignItems: "center", gap: 2, px: 2, py: 1.6, bgcolor: "board.cell", borderLeft: 3, borderColor: i === 0 ? "board.amber" : "transparent" }}
              >
                <Typography component="span" sx={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: i === 0 ? "primary.main" : "text.disabled", width: 34 }}>
                  {line.code}
                </Typography>
                <Typography component="span" sx={{ fontSize: { md: 16, lg: 19 }, fontWeight: 700, textTransform: "uppercase", letterSpacing: "-0.005em", color: i === 0 ? "text.primary" : "text.secondary" }}>
                  {line.text}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Typography component="p" sx={{ display: { xs: "none", md: "block" }, fontFamily: MONO, fontSize: 10.5, color: "text.disabled", overflowWrap: "anywhere" }}>
          {API_ROOT.replace(/^https?:\/\//, "")}
        </Typography>
      </Box>

      {/* ── Bench ─────────────────────────────────────────────────────────── */}
      <Box
        component="main"
        sx={{
          bgcolor: "board.bench",
          // Widths rather than the `borderTop`/`borderLeft` shorthands: inside a breakpoint those
          // expand to "2px solid", which resets the colour back to the text colour.
          borderStyle: "solid",
          borderColor: "board.amber",
          borderWidth: 0,
          borderTopWidth: { xs: 2, md: 0 },
          borderLeftWidth: { xs: 0, md: 2 },
          display: "flex",
          alignItems: { xs: "flex-start", md: "center" },
          justifyContent: "center",
          px: { xs: 2.5, md: 6 },
          py: { xs: 3.5, md: 6 },
        }}
      >
        <Box component="form" onSubmit={submit} noValidate sx={{ width: "100%", maxWidth: 380, display: "grid", gap: 2 }}>
          <Box sx={{ mb: 0.5 }}>
            <Typography component="h1" sx={{ fontSize: { xs: 26, md: 30 }, fontWeight: 800, textTransform: "uppercase", letterSpacing: "-0.01em", lineHeight: 1.05 }}>
              Sign in
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              Use the account your administrator gave you.
            </Typography>
          </Box>

          {unreachable ? (
            <Box role="alert" sx={{ p: 1.5, borderLeft: 3, borderColor: "error.main", bgcolor: "background.default" }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: "error.main" }}>API unreachable</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                The server did not answer, so there is nothing to sign in to yet. Check your connection and try again.
              </Typography>
              <Button variant="outlined" onClick={onRetry} sx={{ mt: 1.25 }}>
                Try again
              </Button>
            </Box>
          ) : (
            <>
              <TextField
                label="Email"
                type="email"
                name="email"
                autoComplete="username"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
                fullWidth
                size="medium"
              />
              <TextField
                label="Password"
                type={reveal ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                fullWidth
                size="medium"
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setReveal((r) => !r)} edge="end" aria-label={reveal ? "Hide password" : "Show password"}>
                          {reveal ? <VisibilityOffOutlinedIcon sx={{ fontSize: 19 }} /> : <VisibilityOutlinedIcon sx={{ fontSize: 19 }} />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />

              {error && (
                <Typography role="alert" variant="body2" sx={{ color: "error.main", borderLeft: 3, borderColor: "error.main", pl: 1.25, py: 0.25 }}>
                  {error}
                </Typography>
              )}

              <Button type="submit" variant="contained" size="large" disabled={busy || !email.trim() || !password} sx={{ py: 1.4, mt: 0.5 }}>
                {busy ? "Signing in…" : "Sign in"}
              </Button>

              <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
                Forgotten your password? Ask your administrator to set a new one.
              </Typography>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}
