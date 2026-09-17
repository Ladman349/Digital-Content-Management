import { useState } from "react";
import { Box, Button, MenuItem, TextField, Typography } from "@mui/material";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { Link as RouterLink } from "react-router-dom";
import { useSnackbar } from "notistack";
import type { MediaItem } from "../../types/media";
import { MEDIA_CATEGORIES, type MediaCategory } from "../../types/media";
import type { Playlist } from "../../types/playlist";
import DetailPanel from "../../components/ui/DetailPanel";
import Field, { FieldGrid, Section } from "../../components/ui/Field";
import StatusChip from "../../components/ui/StatusChip";
import OwnerSection from "../../components/ui/OwnerSection";
import { useUpdateMedia } from "../../hooks/queries";
import { formatBytes, formatDateTime, formatDuration } from "../../utils/format";
import { thumbnailUrl } from "../../utils/media";

/** The parent mounts this with key={media.id}, so local edits reset when a different file is inspected. */
interface Props {
  media: MediaItem;
  playlists: Playlist[];
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  position?: string;
  onDelete: (m: MediaItem) => void;
}

export default function MediaDetailPanel({ media, playlists, onClose, onPrev, onNext, position, onDelete }: Props) {
  const { enqueueSnackbar } = useSnackbar();
  const update = useUpdateMedia();
  const [name, setName] = useState(media.name);
  const [category, setCategory] = useState<MediaCategory>(media.category);

  const usedIn = playlists.filter((p) => p.items.some((i) => i.mediaId === media.id));
  const dirty = name.trim() !== media.name || category !== media.category;
  const isVideo = media.type === "Video";
  const thumb = thumbnailUrl(media);

  const save = () => {
    update.mutate(
      { id: media.id, data: { name: name.trim(), category } },
      { onSuccess: () => enqueueSnackbar("Media updated", { variant: "success" }), onError: (e) => enqueueSnackbar((e as Error).message, { variant: "error" }) },
    );
  };

  return (
    <DetailPanel
      open
      onClose={onClose}
      onPrev={onPrev}
      onNext={onNext}
      position={position}
      width={420}
      title={media.name}
      subtitle={
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <StatusChip label={media.type} dot={false} />
          <span>{media.category}</span>
        </Box>
      }
      actions={
        <>
          <Button variant="outlined" color="error" startIcon={<DeleteOutlineRoundedIcon />} onClick={() => onDelete(media)}>
            Delete
          </Button>
          <Button variant="outlined" component="a" href={media.originalFile} target="_blank" rel="noopener" endIcon={<OpenInNewRoundedIcon sx={{ fontSize: 14 }} />}>
            Open file
          </Button>
          <Button variant="contained" onClick={save} disabled={!dirty || !name.trim() || update.isPending}>
            {update.isPending ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <Box sx={{ mb: 2, borderRadius: 1.5, overflow: "hidden", bgcolor: "#000", aspectRatio: "16 / 9", display: "grid", placeItems: "center" }}>
        {isVideo ? (
          <video key={media.id} src={media.originalFile} controls preload="metadata" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        ) : thumb ? (
          <img src={thumb} alt={media.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        ) : (
          <Typography color="text.disabled">No preview</Typography>
        )}
      </Box>

      <Section title="Details">
        <Box sx={{ display: "grid", gap: 1.5 }}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
          <TextField select label="Category" value={category} onChange={(e) => setCategory(e.target.value as MediaCategory)} fullWidth>
            {MEDIA_CATEGORIES.map((c) => (
              <MenuItem key={c} value={c}>
                {c}
              </MenuItem>
            ))}
          </TextField>
          <FieldGrid>
            <Field label="Size">{formatBytes(media.size)}</Field>
            <Field label="Dimensions">{media.dimensions || "—"}</Field>
            {isVideo && <Field label="Duration">{media.duration ? formatDuration(media.duration) : "Unknown"}</Field>}
            <Field label="Uploaded">{formatDateTime(media.uploadedAt)}</Field>
            <Field label="Media ID" mono>
              {media.id}
            </Field>
            {media.checksum && (
              <Field label="SHA-256" mono>
                {media.checksum.slice(0, 16)}…
              </Field>
            )}
          </FieldGrid>
        </Box>
      </Section>

      <Section title={`Used in playlists (${usedIn.length})`}>
        {usedIn.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Not used in any playlist yet.
          </Typography>
        ) : (
          <Box sx={{ display: "grid", gap: 0.5 }}>
            {usedIn.map((p) => (
              <Box
                key={p.id}
                component={RouterLink}
                to={`/playlists?select=${encodeURIComponent(p.id)}`}
                sx={{ display: "flex", alignItems: "center", gap: 1, p: 1, borderRadius: 1, border: 1, borderColor: "surface.border", textDecoration: "none", color: "inherit", "&:hover": { bgcolor: "surface.hover" } }}
              >
                <Typography sx={{ fontWeight: 600, fontSize: 13, flex: 1 }} noWrap>
                  {p.name}
                </Typography>
                <StatusChip label={p.status} />
              </Box>
            ))}
          </Box>
        )}
      </Section>

      <OwnerSection kind="media" id={media.id} clientId={media.clientId} />
    </DetailPanel>
  );
}
