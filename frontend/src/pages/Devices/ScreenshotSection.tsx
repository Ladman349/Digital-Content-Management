import { useEffect, useState } from "react";
import { Box, Button, LinearProgress, Typography } from "@mui/material";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import { useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { Section } from "../../components/ui/Field";
import { DeviceService } from "../../services/DeviceService";
import { queryKeys } from "../../hooks/queries";
import type { Device } from "../../types/device";
import { relativeTime } from "../../utils/format";

/** The screen answers in the reply to its next heartbeat, which is up to a minute away. */
const GIVE_UP_MS = 3 * 60_000;

/**
 * "Show me what this screen is showing." Asking sets a flag; the screen sees it on its next
 * heartbeat, captures its own window and uploads a small picture, which appears here. Nothing is
 * captured unless someone presses the button.
 */
export default function ScreenshotSection({ device, now }: { device: Device; now: number }) {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [asking, setAsking] = useState(false);
  const [image, setImage] = useState<{ url: string; at: number } | null>(null);

  const asked = device.screenshotRequestedAt ?? 0;
  const taken = device.screenshotAt ?? 0;
  const waiting = asked > taken && now - asked < GIVE_UP_MS;
  const gaveUp = asked > taken && now - asked >= GIVE_UP_MS && now - asked < 30 * 60_000;

  // The picture needs the session, so it is fetched rather than linked, and re-fetched whenever the
  // screen delivers a newer one. The object URL is released when it is replaced or the panel closes.
  useEffect(() => {
    if (!taken) return;
    let cancelled = false;
    let url: string | null = null;
    DeviceService.screenshot(device.id)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setImage({ url, at: taken });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [device.id, taken]);

  // While waiting, look for the answer more often than the screens list normally refreshes.
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => void queryClient.invalidateQueries({ queryKey: queryKeys.devices }), 5_000);
    return () => clearInterval(timer);
  }, [waiting, queryClient]);

  const ask = async () => {
    setAsking(true);
    try {
      await DeviceService.requestScreenshot(device.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.devices });
    } catch (e) {
      enqueueSnackbar((e as Error).message, { variant: "error" });
    } finally {
      setAsking(false);
    }
  };

  const current = image && image.at === taken ? image : null;
  const offline = device.status === "Offline";

  return (
    <Section
      title="Screenshot"
      action={
        <Button size="small" startIcon={<PhotoCameraOutlinedIcon sx={{ fontSize: 15 }} />} onClick={ask} disabled={asking || waiting}>
          {waiting ? "Waiting…" : current ? "Take another" : "Take screenshot"}
        </Button>
      }
    >
      {waiting && <LinearProgress sx={{ height: 2, mb: 1 }} />}
      {current ? (
        <Box>
          <Box component="img" src={current.url} alt={`What ${device.name} was showing`} sx={{ display: "block", width: "100%", maxHeight: 260, objectFit: "contain", bgcolor: "#000", border: 1, borderColor: "surface.border" }} />
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
            Taken {relativeTime(current.at, now)}
          </Typography>
        </Box>
      ) : (
        !waiting &&
        !gaveUp && (
          <Typography variant="body2" color="text.secondary">
            {offline ? "The screen is offline, so it cannot answer until it is back." : "See exactly what this screen is showing. It answers within a minute."}
          </Typography>
        )
      )}
      {waiting && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: current ? 0.5 : 0 }}>
          Asked {relativeTime(asked, now)}. The screen answers on its next check-in, up to a minute away.
        </Typography>
      )}
      {gaveUp && (
        <Typography variant="body2" color="warning.main" sx={{ mt: current ? 0.5 : 0 }}>
          The screen did not answer. It has to be online and running player 1.4.0 or newer.
        </Typography>
      )}
    </Section>
  );
}
