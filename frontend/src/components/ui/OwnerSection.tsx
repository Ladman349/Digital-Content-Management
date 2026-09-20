import { useState } from "react";
import { MenuItem, TextField } from "@mui/material";
import { useSnackbar } from "notistack";
import { useAuth } from "../../auth/AuthProvider";
import { useClients, useUpdateDevice, useUpdateMedia, useUpdatePlaylist, useUpdateSchedule } from "../../hooks/queries";
import { Section } from "./Field";
import HandoverDialog from "./HandoverDialog";

type Kind = "screen" | "media" | "playlist" | "schedule";

interface Props {
  kind: Kind;
  id: string;
  clientId?: string | null;
  /** Shown in the handover dialog; screens only. */
  name?: string;
}

const HELP: Record<Kind, string> = {
  screen: "The client sees and controls this screen. Changing this offers to hand over what it plays too.",
  media: "Only this client can see the file or use it in a playlist.",
  playlist: "Only this client can see or edit the playlist.",
  schedule: "Only this client can see or edit the schedule.",
};

/**
 * Administrators only: which client a row belongs to. It is the one place ownership changes hands,
 * and the usual first step for a screen, which registers itself belonging to nobody. A screen goes
 * through the handover dialog, so its playlists, media and schedules can travel with it.
 *
 * Renders nothing for client users, and nothing until a client exists, so a deployment that never
 * uses clients never sees the concept.
 */
export default function OwnerSection({ kind, id, clientId, name }: Props) {
  const { isAdmin } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const { data: clients = [] } = useClients(isAdmin);
  const device = useUpdateDevice();
  const media = useUpdateMedia();
  const playlist = useUpdatePlaylist();
  const schedule = useUpdateSchedule();
  const [handoverTo, setHandoverTo] = useState<string | null>(null);

  if (!isAdmin || clients.length === 0) return null;

  const mutation = { screen: device, media, playlist, schedule }[kind];

  const change = (next: string) => {
    if (kind === "screen") {
      setHandoverTo(next);
      return;
    }
    const owner = next || null;
    const name = clients.find((c) => c.id === owner)?.name;
    mutation.mutate(
      { id, data: { clientId: owner } },
      {
        onSuccess: () => enqueueSnackbar(name ? `Now belongs to ${name}` : "Handed back to the operator", { variant: "success" }),
        onError: (e) => enqueueSnackbar((e as Error).message, { variant: "error" }),
      },
    );
  };

  return (
    <Section title="Client">
      <TextField select label="Belongs to" value={clientId ?? ""} onChange={(e) => change(e.target.value)} disabled={mutation.isPending} helperText={HELP[kind]} fullWidth>
        <MenuItem value="">
          <em>Operator (no client)</em>
        </MenuItem>
        {clients.map((c) => (
          <MenuItem key={c.id} value={c.id}>
            {c.name}
          </MenuItem>
        ))}
      </TextField>
      {handoverTo !== null && <HandoverDialog open devices={[{ id, name: name ?? id }]} initialClientId={handoverTo} onClose={() => setHandoverTo(null)} />}
    </Section>
  );
}
