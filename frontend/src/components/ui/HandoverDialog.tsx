import { useMemo, useState } from "react";
import { Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, LinearProgress, MenuItem, TextField, Typography } from "@mui/material";
import { useSnackbar } from "notistack";
import { MONO } from "../../app/theme";
import { useClients, useHandover, useHandoverPreview } from "../../hooks/queries";
import type { HandoverItem, HandoverKind } from "../../types/account";

interface Props {
  open: boolean;
  /** Screens being handed over. */
  devices: { id: string; name: string }[];
  /** Pre-selects the receiving client; "" is the operator. Leave undefined to make the person choose. */
  initialClientId?: string;
  onClose: () => void;
  onDone?: () => void;
}

const OPERATOR = "__operator__";
const KIND_ORDER: HandoverKind[] = ["screen", "playlist", "media", "schedule"];
const KIND_LABEL: Record<HandoverKind, [string, string]> = {
  screen: ["screen", "screens"],
  playlist: ["playlist", "playlists"],
  media: ["media file", "media files"],
  schedule: ["schedule", "schedules"],
};

const count = (n: number, kind: HandoverKind) => `${n} ${KIND_LABEL[kind][n === 1 ? 0 : 1]}`;

function summarise(items: HandoverItem[]): string {
  return KIND_ORDER.map((kind) => [kind, items.filter((i) => i.kind === kind).length] as const)
    .filter(([, n]) => n > 0)
    .map(([kind, n]) => count(n, kind))
    .join(" · ");
}

/**
 * Hands screens to a client together with what they play, showing first what will travel and what
 * has to stay because something else still uses it. The server decides both; this only displays it.
 */
export default function HandoverDialog({ open, devices, initialClientId, onClose, onDone }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const { data: clients = [] } = useClients(open);
  const [target, setTarget] = useState<string>(initialClientId === undefined ? "" : initialClientId || OPERATOR);
  const [includeContent, setIncludeContent] = useState(true);
  const handover = useHandover();

  const deviceIds = useMemo(() => devices.map((d) => d.id), [devices]);
  const request = useMemo(
    () => (open && target && deviceIds.length > 0 ? { deviceIds, clientId: target === OPERATOR ? null : target, includeContent } : null),
    [open, target, deviceIds, includeContent],
  );
  const preview = useHandoverPreview(request);
  const plan = preview.data;
  const receiver = target === OPERATOR ? "the operator" : (clients.find((c) => c.id === target)?.name ?? "the client");
  const title = devices.length === 1 ? `Hand over ${devices[0].name}` : `Hand over ${devices.length} screens`;

  const confirm = async () => {
    if (!request) return;
    try {
      const done = await handover.mutateAsync(request);
      const stayed = done.left.length > 0 ? ` ${done.left.length} shared item${done.left.length === 1 ? "" : "s"} stayed where ${done.left.length === 1 ? "it was" : "they were"}.` : "";
      enqueueSnackbar(`${summarise(done.moved) || "Nothing"} now with ${receiver}.${stayed}`, { variant: "success" });
      onDone?.();
      onClose();
    } catch (e) {
      enqueueSnackbar((e as Error).message, { variant: "error" });
    }
  };

  return (
    <Dialog open={open} onClose={handover.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: 2, pt: "12px !important" }}>
        <TextField select label="Hand over to" value={target} onChange={(e) => setTarget(e.target.value)} fullWidth autoFocus={initialClientId === undefined}>
          {clients.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.name}
            </MenuItem>
          ))}
          <MenuItem value={OPERATOR}>
            <em>Operator (no client)</em>
          </MenuItem>
        </TextField>

        <FormControlLabel
          control={<Checkbox checked={includeContent} onChange={(e) => setIncludeContent(e.target.checked)} />}
          label={
            <Box>
              <Typography variant="body2">Also hand over what {devices.length === 1 ? "it plays" : "they play"}</Typography>
              <Typography variant="caption" color="text.secondary">
                Playlists, media and schedules used only by {devices.length === 1 ? "this screen" : "these screens"}. Without them the client sees a screen that appears to show nothing.
              </Typography>
            </Box>
          }
          sx={{ alignItems: "flex-start", m: 0, gap: 0.5, "& .MuiCheckbox-root": { mt: -0.75, ml: -1 } }}
        />

        {request && (
          <Box sx={{ border: 1, borderColor: "surface.border", borderRadius: 1.5, overflow: "hidden", minHeight: 72 }}>
            {preview.isFetching && <LinearProgress sx={{ height: 2 }} />}
            {preview.error && (
              <Typography role="alert" variant="body2" color="error" sx={{ p: 1.5 }}>
                {(preview.error as Error).message}
              </Typography>
            )}
            {plan && (
              <>
                <Group heading={plan.moved.length > 0 ? `Goes to ${receiver}` : `Already with ${receiver}`} summary={summarise(plan.moved) || "Nothing needs to move."}>
                  {plan.moved
                    .filter((i) => i.kind !== "screen" || devices.length > 1)
                    .map((i) => (
                      <Row key={`${i.kind}-${i.id}`} item={i} />
                    ))}
                </Group>
                {plan.left.length > 0 && (
                  <Group heading="Stays where it is" summary={`${summarise(plan.left)} · still in use elsewhere, so ${receiver} will not see ${plan.left.length === 1 ? "it" : "them"}. The screen keeps playing.`} tone="warning">
                    {plan.left.map((i) => (
                      <Row key={`${i.kind}-${i.id}`} item={i} reason={i.reason} />
                    ))}
                  </Group>
                )}
              </>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose} disabled={handover.isPending}>
          Cancel
        </Button>
        <Button variant="contained" onClick={confirm} disabled={!plan || plan.moved.length === 0 || preview.isFetching || handover.isPending}>
          {handover.isPending ? "Handing over…" : "Hand over"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function Group({ heading, summary, tone, children }: { heading: string; summary: string; tone?: "warning"; children: React.ReactNode }) {
  return (
    <Box sx={{ p: 1.5, "& + &": { borderTop: 1, borderColor: "surface.border" }, bgcolor: tone ? "action.hover" : undefined }}>
      <Typography variant="subtitle2" sx={{ color: tone ? "warning.main" : "text.primary" }}>
        {heading}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
        {summary}
      </Typography>
      <Box sx={{ maxHeight: 168, overflowY: "auto" }}>{children}</Box>
    </Box>
  );
}

function Row({ item, reason }: { item: HandoverItem; reason?: string }) {
  return (
    <Box sx={{ display: "flex", gap: 1.25, alignItems: "baseline", py: 0.4, minWidth: 0 }}>
      <Typography sx={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.04em", textTransform: "uppercase", color: "text.secondary", flex: "0 0 62px" }}>{KIND_LABEL[item.kind][0].split(" ")[0]}</Typography>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 12.5, fontWeight: 500, overflowWrap: "anywhere" }}>{item.name}</Typography>
        {reason && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            {reason}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
