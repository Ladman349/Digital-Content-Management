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
import MediaThumb from "../../components/ui/MediaThumb";
import { useUpdatePlaylist } from "../../hooks/queries";
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
          <Typography variant="body2" color="error.main" sx={{ mb: 1 }}>
            {missing} item{missing === 1 ? "" : "s"} reference deleted media. Edit the playlist to remove them.
          </Typography>
        )}
        <Box sx={{ display: "grid", gap: 0.5 }}>
          {playlist.items.map((item, i) => {
            const m = mediaById.get(item.mediaId);
            return (
              <Box key={item.id} sx={{ display: "flex", alignItems: "center", gap: 1, p: 0.75, borderRadius: 1, border: 1, borderColor: "surface.border" }}>
                <Typography variant="caption" color="text.secondary" sx={{ width: 16, textAlign: "right" }}>
                  {i + 1}
                </Typography>
                <MediaThumb media={m} width={44} height={28} />
                <Typography sx={{ flex: 1, fontSize: 12.5, fontWeight: 600 }} noWrap>
                  {m?.name ?? `Missing (${item.mediaId})`}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.duration}s
                </Typography>
              </Box>
            );
          })}
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
              <Chip key={d.id} component={RouterLink} to={`/devices?select=${encodeURIComponent(d.id)}`} clickable label={d.name} variant="outlined" />
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
    </DetailPanel>
  );
}
