import { useCallback, useRef, useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, LinearProgress, MenuItem, TextField, Typography } from "@mui/material";
import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import { useDropzone } from "react-dropzone";
import { useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { MediaService } from "../../services/MediaService";
import { queryKeys } from "../../hooks/queries";
import { MEDIA_CATEGORIES, type MediaCategory, type MediaItem } from "../../types/media";
import { formatBytes } from "../../utils/format";
import { probeFile } from "../../utils/media";

const ACCEPT = { "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"], "image/webp": [".webp"], "image/gif": [".gif"], "video/mp4": [".mp4"], "video/webm": [".webm"], "video/quicktime": [".mov"] };
const MAX_BYTES = 100 * 1024 * 1024;
const CONCURRENCY = 2;

interface QueueItem {
  id: string;
  file: File;
  progress: number;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
  result?: MediaItem;
}

/** Mounted by the parent only while open, so the queue always starts empty. */
interface Props {
  onClose: () => void;
  onUploaded?: (items: MediaItem[]) => void;
}

export default function UploadDialog({ onClose, onUploaded }: Props) {
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [category, setCategory] = useState<MediaCategory>("Announcement");
  const [running, setRunning] = useState(false);
  const abortRef = useRef<Map<string, () => void>>(new Map());

  const onDrop = useCallback((accepted: File[]) => {
    setQueue((q) => [
      ...q,
      ...accepted.map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        progress: 0,
        status: file.size > MAX_BYTES ? ("error" as const) : ("queued" as const),
        error: file.size > MAX_BYTES ? "Larger than the 100 MB limit" : undefined,
      })),
    ]);
  }, []);

  const { getRootProps, getInputProps, isDragActive, open: openPicker } = useDropzone({ onDrop, accept: ACCEPT, multiple: true, noClick: true, disabled: running });

  const patch = (id: string, changes: Partial<QueueItem>) => setQueue((q) => q.map((it) => (it.id === id ? { ...it, ...changes } : it)));

  const uploadOne = async (item: QueueItem): Promise<MediaItem | null> => {
    patch(item.id, { status: "uploading", progress: 0 });
    const probePromise = probeFile(item.file);
    const handle = MediaService.upload(item.file, (f) => patch(item.id, { progress: f }));
    abortRef.current.set(item.id, handle.abort);
    try {
      let created = await handle.promise;
      const probe = await probePromise;
      const update: { category?: MediaCategory; dimensions?: string; duration?: number } = {};
      if (category !== created.category) update.category = category;
      if (probe.dimensions && probe.dimensions !== created.dimensions) update.dimensions = probe.dimensions;
      if (probe.duration && probe.duration !== created.duration) update.duration = probe.duration;
      if (Object.keys(update).length) {
        try {
          created = await MediaService.update(created.id, update);
        } catch {
          /* metadata is best-effort; the file itself is uploaded */
        }
      }
      patch(item.id, { status: "done", progress: 1, result: created });
      return created;
    } catch (e) {
      patch(item.id, { status: "error", error: (e as Error).message });
      return null;
    } finally {
      abortRef.current.delete(item.id);
    }
  };

  const start = async () => {
    const pending = queue.filter((q) => q.status === "queued");
    if (!pending.length) return;
    setRunning(true);
    const results: MediaItem[] = [];
    let index = 0;
    const worker = async () => {
      while (index < pending.length) {
        const item = pending[index++];
        const r = await uploadOne(item);
        if (r) results.push(r);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker));
    setRunning(false);
    await qc.invalidateQueries({ queryKey: queryKeys.media });
    if (results.length) {
      enqueueSnackbar(`${results.length} file${results.length === 1 ? "" : "s"} uploaded`, { variant: "success" });
      onUploaded?.(results);
    }
  };

  const remove = (id: string) => {
    abortRef.current.get(id)?.();
    setQueue((q) => q.filter((it) => it.id !== id));
  };

  const handleClose = () => {
    abortRef.current.forEach((abort) => abort());
    onClose();
  };

  const queued = queue.filter((q) => q.status === "queued").length;
  const done = queue.filter((q) => q.status === "done").length;
  const allFinished = queue.length > 0 && queued === 0 && !running;

  return (
    <Dialog open onClose={running ? undefined : handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Upload media</DialogTitle>
      <DialogContent>
        <Box
          {...getRootProps()}
          onClick={openPicker}
          sx={{
            border: 2,
            borderStyle: "dashed",
            borderColor: isDragActive ? "primary.main" : "surface.borderStrong",
            bgcolor: isDragActive ? (t) => `${t.palette.primary.main}0D` : "surface.subtle",
            borderRadius: 2,
            p: 3,
            textAlign: "center",
            cursor: running ? "default" : "pointer",
            transition: "border-color .15s, background-color .15s",
          }}
        >
          <input {...getInputProps()} />
          <CloudUploadRoundedIcon sx={{ fontSize: 30, color: "text.disabled" }} />
          <Typography sx={{ fontWeight: 600, mt: 0.5 }}>{isDragActive ? "Drop to add files" : "Drop images or videos here, or click to browse"}</Typography>
          <Typography variant="caption" color="text.secondary">
            PNG, JPG, WEBP, GIF, MP4, WEBM, MOV · up to 100 MB each
          </Typography>
        </Box>

        <TextField select label="Category for these files" value={category} onChange={(e) => setCategory(e.target.value as MediaCategory)} sx={{ mt: 2, width: 240 }} disabled={running}>
          {MEDIA_CATEGORIES.map((c) => (
            <MenuItem key={c} value={c}>
              {c}
            </MenuItem>
          ))}
        </TextField>

        {queue.length > 0 && (
          <Box sx={{ mt: 2, display: "grid", gap: 0.75, maxHeight: 300, overflowY: "auto" }}>
            {queue.map((item) => (
              <Box key={item.id} sx={{ display: "flex", alignItems: "center", gap: 1.25, p: 1, border: 1, borderColor: "surface.border", borderRadius: 1.5 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }} noWrap title={item.file.name}>
                      {item.file.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                      {formatBytes(item.file.size)}
                    </Typography>
                  </Box>
                  {item.status === "uploading" && <LinearProgress variant="determinate" value={item.progress * 100} sx={{ mt: 0.75 }} />}
                  {item.status === "error" && (
                    <Typography variant="caption" color="error.main">
                      {item.error}
                    </Typography>
                  )}
                  {item.status === "done" && item.result && (
                    <Typography variant="caption" color="text.secondary">
                      {item.result.type} · {item.result.dimensions}
                    </Typography>
                  )}
                </Box>
                {item.status === "done" ? (
                  <CheckCircleRoundedIcon sx={{ color: "success.main", fontSize: 20 }} />
                ) : item.status === "error" ? (
                  <ErrorOutlineRoundedIcon sx={{ color: "error.main", fontSize: 20 }} />
                ) : (
                  <IconButton onClick={() => remove(item.id)} aria-label="Remove file">
                    <CloseRoundedIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                )}
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Typography variant="body2" color="text.secondary" sx={{ mr: "auto" }}>
          {queue.length > 0 && `${done} of ${queue.length} uploaded`}
        </Typography>
        <Button variant="outlined" onClick={handleClose} disabled={running}>
          {allFinished ? "Close" : "Cancel"}
        </Button>
        <Button variant="contained" onClick={start} disabled={running || queued === 0}>
          {running ? "Uploading…" : `Upload ${queued > 0 ? queued : ""}`.trim()}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
