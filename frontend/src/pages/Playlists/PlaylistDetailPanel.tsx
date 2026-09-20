import { Box, Button, Chip, MenuItem, TextField, Typography } from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { Link as RouterLink } from "react-router-dom";
import { useSnackbar } from "notistack";
import type { Playlist, PlaylistStatus } from "../../types/playlist";
import type { MediaItem } from "../../types/media";
import type { Device } from "../../types/device";
import type { Schedule } from "../../types/schedule";
import DetailPanel from "../../components/ui/DetailPanel";
import Field, { FieldGrid, Section } from "../../components/ui/Field";
import StatusChip from "../../components/ui/StatusChip";
import OwnerSection from "../../components/ui/OwnerSection";
import MediaThumb from "../../components/ui/MediaThumb";
import { useUpdatePlaylist } from "../../hooks/queries";
import { useAuth } from "../../auth/AuthProvider";
import { formatDateTime, formatDuration, pluralize } from "../../utils/format";

interface Props {
  playlist: Playlist | null;
  media: MediaItem[];
  devices: Device[];
  schedules: Schedule[];
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  position?: string;
  onEdit: (p: Playlist) => void;
  onDelete: (p: Playlist) => void;
  onAssign: (p: Playlist) => void;
}

export default function PlaylistDetailPanel({ playlist, media, devices, schedules, onClose, onPrev, onNext, position, onEdit, onDelete, onAssign }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const { isAdmin } = useAuth();
  const update = useUpdatePlaylist();

  if (!playlist) return null;

  const mediaById = new Map(media.map((m) => [m.id, m]));
  const assigned = devices.filter((d) => playlist.assignedDeviceIds.includes(d.id));
  const usedBy = schedules.filter((s) => s.playlistId === playlist.id);
  const missing = playlist.items.filter((i) => !mediaById.has(i.mediaId)).length;

  const changeStatus = (status: PlaylistStatus) => {
    update.mutate(
      { id: playlist.id, data: { status } },
      { onSuccess: () => enqueueSnackbar(`Playlist is now ${status}`, { variant: "success" }), onError: (e) => enqueueSnackbar((e as Error).message, { variant: "error" }) },
    );
  };

  return (
    <DetailPanel
      open
      onClose={onClose}
      onPrev={onPrev}
      onNext={onNext}
      position={position}
      title={playlist.name}
      subtitle={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <StatusChip label={playlist.status} />
          <span>
            {pluralize(playlist.items.length, "item")} · {formatDuration(playlist.totalDuration)}
          </span>
        </Box>
      }
      actions={
        <>
          <Button variant="outlined" color="error" startIcon={<DeleteOutlineRoundedIcon />} onClick={() => onDelete(playlist)}>
            Delete
          </Button>
          <Button variant="contained" startIcon={<EditOutlinedIcon />} onClick={() => onEdit(playlist)}>
            Edit
          </Button>
        </>
      }
    >
      {playlist.description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {playlist.description}
        </Typography>
      )}

      <Section title="Settings">
        <Box sx={{ display: "grid", gap: 1.5 }}>
          <TextField select label="Status" value={playlist.status} onChange={(e) => changeStatus(e.target.value as PlaylistStatus)} disabled={update.isPending} helperText="Only Published playlists can be scheduled" fullWidth>
            <MenuItem value="Draft">Draft</MenuItem>
            <MenuItem value="Published">Published</MenuItem>
            <MenuItem value="Archived">Archived</MenuItem>
          </TextField>
          <FieldGrid>
            <Field label="Playlist ID" mono>
              {playlist.id}
            </Field>
            <Field label="Last updated">{formatDateTime(playlist.updatedAt)}</Field>
          </FieldGrid>
        </Box>
      </Section>

      <Section title={`Sequence (${playlist.items.length})`}>
        {missing > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {/* Media in use cannot be deleted, so a file missing from the list is one this view does not include. */}
            {isAdmin
              ? `${missing} item${missing === 1 ? " uses" : "s use"} media outside this view (the operator's or another client's). ${missing === 1 ? "It still plays" : "They still play"}.`
              : `${missing} item${missing === 1 ? " was" : "s were"} added by your operator. ${missing === 1 ? "It still plays" : "They still play"}, and you can reorder or remove ${missing === 1 ? "it" : "them"}.`}
          </Typography>
        )}
        <Box sx={{ display: "grid", gap: "2px" }}>
          {playlist.items.map((item, i) => {
            const m = mediaById.get(item.mediaId);
            const startsAt = playlist.items.slice(0, i).reduce((sum, x) => sum + x.duration, 0);
            return (
              <Box
                key={item.id}
                sx={{
                  display: "grid",
                  gridTemplateColumns: "26px 44px 1fr 52px 56px",
                  alignItems: "center",
                  gap: 1,
                  px: 1,
                  py: 0.75,
                  bgcolor: "board.cell",
                }}
              >
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {String(i + 1).padStart(2, "0")}
                </Typography>
                <MediaThumb media={m} width={44} height={26} />
                <Typography sx={{ fontSize: 12.5, fontWeight: 500 }} noWrap title={m?.name}>
                  {m?.name ?? (isAdmin ? `Outside this view (${item.mediaId})` : "Provided by your operator")}
                </Typography>
                <Typography variant="caption" sx={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {formatDuration(item.duration)}
                </Typography>
                <Typography variant="caption" sx={{ textAlign: "right", color: "primary.main", fontVariantNumeric: "tabular-nums" }}>
                  {formatDuration(startsAt)}
                </Typography>
              </Box>
            );
          })}
          {playlist.items.length > 0 && (
            <Box sx={{ display: "grid", gridTemplateColumns: "26px 44px 1fr 52px 56px", alignItems: "center", gap: 1, px: 1, py: 0.75 }}>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                ↻
              </Typography>
              <Box />
              <Typography sx={{ fontSize: 12, color: "text.secondary" }}>loop returns to item 01</Typography>
              <Box />
              <Typography variant="caption" sx={{ textAlign: "right", color: "primary.main", fontVariantNumeric: "tabular-nums" }}>
                {formatDuration(playlist.totalDuration)}
              </Typography>
            </Box>
          )}
        </Box>
      </Section>

      <Section
        title={`Directly assigned screens (${assigned.length})`}
        action={
          <Button size="small" onClick={() => onAssign(playlist)}>
            Change
          </Button>
        }
      >
        {assigned.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No screens play this by default. Assign screens, or schedule it for specific times.
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            {assigned.map((d) => (
              <Chip
                key={d.id}
                component={RouterLink}
                to={`/devices?select=${encodeURIComponent(d.id)}`}
                clickable
                label={d.name}
                variant="outlined"
                sx={{ maxWidth: "100%", height: "auto", py: 0.4, "& .MuiChip-label": { whiteSpace: "normal", lineHeight: 1.35 } }}
              />
            ))}
          </Box>
        )}
      </Section>

      <Section title={`Schedules using this playlist (${usedBy.length})`}>
        {usedBy.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            None.
          </Typography>
        ) : (
          <Box sx={{ display: "grid", gap: 0.5 }}>
            {usedBy.map((s) => (
              <Box
                key={s.id}
                component={RouterLink}
                to={`/schedule?select=${encodeURIComponent(s.id)}`}
                sx={{ display: "flex", alignItems: "center", gap: 1, p: 1, borderRadius: 1, border: 1, borderColor: "surface.border", textDecoration: "none", color: "inherit", "&:hover": { bgcolor: "surface.hover" } }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: 13 }} noWrap>
                    {s.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {s.startTime}–{s.endTime} · {s.repeat}
                  </Typography>
                </Box>
                <StatusChip label={s.status} />
              </Box>
            ))}
          </Box>
        )}
      </Section>

      <OwnerSection kind="playlist" id={playlist.id} clientId={playlist.clientId} />
    </DetailPanel>
  );
}
