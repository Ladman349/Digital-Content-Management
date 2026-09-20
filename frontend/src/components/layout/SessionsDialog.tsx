import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Typography } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { AuthService } from "../../services/AccountService";
import type { UserSessionInfo } from "../../types/account";
import { relativeTime } from "../../utils/format";
import { useNow } from "../../hooks/useNow";
import { MONO } from "../../app/theme";

const SESSIONS_KEY = ["auth", "sessions"] as const;

/** "Chrome on Windows", "Signage app on Android": enough to recognise a device, no more. */
function describe(userAgent?: string | null): string {
  const ua = userAgent ?? "";
  if (!ua) return "Unknown device";
  const system = /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  // The phone apps are a web view, which says so: "; wv)" on Android, no "Safari" token on iOS.
  const inApp = /; wv\)/.test(ua) || (system === "iOS" && !/Safari\//.test(ua));
  const browser = inApp ? "Signage app" : /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return system ? `${browser} on ${system}` : browser;
}

/**
 * Everywhere this account is signed in, with a way to sign any of it out. A client's login ends up
 * on shared and borrowed phones; this is how they take it back without calling the operator.
 */
export default function SessionsDialog({ onClose }: { onClose: () => void }) {
  const { enqueueSnackbar } = useSnackbar();
  const now = useNow(60_000);
  const queryClient = useQueryClient();
  const { data: sessions = [], isLoading, error } = useQuery({ queryKey: SESSIONS_KEY, queryFn: AuthService.sessions, staleTime: 0 });
  const refresh = () => queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
  const fail = (e: unknown) => enqueueSnackbar((e as Error).message, { variant: "error" });

  const endOne = useMutation({
    mutationFn: (s: UserSessionInfo) => AuthService.endSession(s.id),
    onSuccess: () => {
      enqueueSnackbar("Signed out on that device", { variant: "success" });
      void refresh();
    },
    onError: fail,
  });
  const endOthers = useMutation({
    mutationFn: AuthService.endOtherSessions,
    onSuccess: () => {
      enqueueSnackbar("Signed out everywhere else", { variant: "success" });
      void refresh();
    },
    onError: fail,
  });

  const others = sessions.filter((s) => !s.current).length;
  const busy = endOne.isPending || endOthers.isPending;

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Signed-in devices</DialogTitle>
      <DialogContent sx={{ pt: "4px !important" }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          A sign-in lasts 30 days from its last use. If you do not recognise one, sign it out and change your password.
        </Typography>
        {isLoading && <LinearProgress sx={{ height: 2 }} />}
        {error && (
          <Typography role="alert" variant="body2" color="error">
            {(error as Error).message}
          </Typography>
        )}
        <Box sx={{ display: "grid", gap: "1px", bgcolor: "surface.border", border: sessions.length ? 1 : 0, borderColor: "surface.border" }}>
          {sessions.map((s) => (
            <Box key={s.id} sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 1.25, bgcolor: "background.paper", minWidth: 0 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600 }} noWrap>
                  {describe(s.userAgent)}
                </Typography>
                <Typography sx={{ fontFamily: MONO, fontSize: 10.5, color: "text.secondary" }} noWrap>
                  {s.current ? "This device · active now" : `Last used ${relativeTime(s.lastUsedAt, now)}`} · signed in {relativeTime(s.createdAt, now)}
                </Typography>
              </Box>
              {s.current ? (
                <Typography sx={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "primary.main", flexShrink: 0 }}>Current</Typography>
              ) : (
                <Button size="small" variant="outlined" onClick={() => endOne.mutate(s)} disabled={busy} sx={{ flexShrink: 0 }}>
                  Sign out
                </Button>
              )}
            </Box>
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" color="error" onClick={() => endOthers.mutate()} disabled={busy || others === 0} sx={{ mr: "auto" }}>
          Sign out everywhere else
        </Button>
        <Button variant="contained" onClick={onClose}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}
