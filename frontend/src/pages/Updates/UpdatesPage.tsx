import { useMemo, useState } from "react";
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, LinearProgress, Paper, Switch, TextField, Tooltip, Typography } from "@mui/material";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import SystemUpdateAltRoundedIcon from "@mui/icons-material/SystemUpdateAltRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { useSnackbar } from "notistack";
import { Link as RouterLink } from "react-router-dom";

import PageHeader from "../../components/ui/PageHeader";
import DataTable, { type Column } from "../../components/ui/DataTable";
import EmptyState from "../../components/ui/EmptyState";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import StatusChip from "../../components/ui/StatusChip";
import { useAppUpdates, useDeleteAppUpdate, useDevices, useToggleAppUpdate, useUploadAppUpdate } from "../../hooks/queries";
import type { AppUpdate } from "../../types/appUpdate";
import { formatBytes, formatDateTime } from "../../utils/format";

export default function UpdatesPage() {
  const { enqueueSnackbar } = useSnackbar();
  const { data: updates = [], isLoading, error, refetch } = useAppUpdates();
  const { data: devices = [] } = useDevices();
  const toggle = useToggleAppUpdate();
  const remove = useDeleteAppUpdate();
  const upload = useUploadAppUpdate();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [versionName, setVersionName] = useState("");
  const [versionCode, setVersionCode] = useState("");
  const [mandatory, setMandatory] = useState(false);
  const [activate, setActivate] = useState(false);
  const [notes, setNotes] = useState("");
  const [progress, setProgress] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<AppUpdate | null>(null);

  const active = updates.find((u) => u.is_active);
  const fleet = useMemo(() => {
    const map = new Map<string, number>();
    devices.forEach((d) => {
      const v = d.appVersion?.trim() || "unknown";
      map.set(v, (map.get(v) ?? 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [devices]);

  const resetForm = () => {
    setFile(null);
    setVersionName("");
    setVersionCode("");
    setMandatory(false);
    setActivate(false);
    setNotes("");
    setProgress(0);
  };

  const submit = async () => {
    if (!file) return;
    try {
      await upload.mutateAsync({ payload: { file, versionName: versionName.trim(), versionCode: Number(versionCode), mandatory, isActive: activate, releaseNotes: notes.trim() || undefined }, onProgress: setProgress });
      enqueueSnackbar(`Release ${versionName} uploaded`, { variant: "success" });
      setUploadOpen(false);
      resetForm();
    } catch (e) {
      enqueueSnackbar((e as Error).message, { variant: "error" });
    }
  };

  const onToggle = (u: AppUpdate) =>
    toggle.mutate(
      { id: u.id, active: !u.is_active },
      { onSuccess: () => enqueueSnackbar(u.is_active ? `Release ${u.version_name} deactivated` : `Release ${u.version_name} is now the active update`, { variant: "success" }), onError: (e) => enqueueSnackbar((e as Error).message, { variant: "error" }) },
    );

  const columns: Column<AppUpdate>[] = [
    {
      key: "version",
      label: "Release",
      render: (u) => (
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Typography sx={{ fontWeight: 600, fontSize: 13 }}>{u.version_name}</Typography>
            {u.is_active && <StatusChip label="Active" tone="success" />}
            {u.mandatory && <Chip label="Mandatory" color="warning" variant="outlined" />}
            {!u.storage_uri && (
              <Tooltip title="This APK sits on the backend's local disk and is deleted on the next redeploy. Re-upload it once object storage is configured.">
                <Chip icon={<WarningAmberRoundedIcon sx={{ fontSize: 13 }} />} label="Not durable" color="error" variant="outlined" />
              </Tooltip>
            )}
          </Box>
          <Typography variant="caption" color="text.secondary">
            build {u.version_code} · {u.apk_filename}
          </Typography>
        </Box>
      ),
    },
    { key: "notes", label: "Release notes", hideBelow: "md", render: (u) => <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-line", maxWidth: 360 }}>{u.release_notes || "—"}</Typography> },
    { key: "size", label: "Size", width: 90, align: "right", render: (u) => <Typography variant="body2">{formatBytes(u.file_size)}</Typography> },
    { key: "downloads", label: "Downloads", width: 100, align: "right", hideBelow: "sm", render: (u) => <Typography variant="body2">{u.download_count}</Typography> },
    { key: "created", label: "Uploaded", width: 170, hideBelow: "lg", render: (u) => <Typography variant="body2" color="text.secondary">{formatDateTime(u.created_at)}</Typography> },
    {
      key: "actions",
      label: "",
      width: 200,
      align: "right",
      onCard: true,
      render: (u) => (
        <Box sx={{ display: "flex", gap: 0.75, justifyContent: "flex-end", flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
          <Button size="small" variant={u.is_active ? "outlined" : "contained"} onClick={() => onToggle(u)} disabled={toggle.isPending}>
            {u.is_active ? "Deactivate" : "Activate"}
          </Button>
          <Tooltip title="Delete release">
            <span>
              <Button size="small" variant="outlined" color="error" onClick={() => setDeleteTarget(u)} disabled={u.is_active} sx={{ minWidth: 0, px: 1 }} aria-label="Delete release">
                <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
              </Button>
            </span>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader
        title="App updates"
        meta={active ? <span>Active release {active.version_name} (build {active.version_code})</span> : <span>No active release</span>}
        actions={
          <Button variant="contained" startIcon={<UploadFileRoundedIcon />} onClick={() => setUploadOpen(true)}>
            Upload APK
          </Button>
        }
      />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 3fr) minmax(0, 1fr)" }, gap: 2, alignItems: "start" }}>
        <DataTable<AppUpdate>
          columns={columns}
          rows={updates}
          rowKey={(u) => u.id}
          loading={isLoading}
          error={error ? (error as Error).message : null}
          onRetry={() => refetch()}
          noun="releases"
          emptyState={
            <EmptyState
              icon={SystemUpdateAltRoundedIcon}
              title="No releases uploaded"
              description="Upload a signed player APK and mark it active. Players check shortly after starting and every six hours after that, then download, verify and install it on their own."
              actionLabel="Upload APK"
              onAction={() => setUploadOpen(true)}
            />
          }
        />

        <Paper sx={{ border: 1, borderColor: "surface.border", borderRadius: 2 }}>
          <Box sx={{ px: 1.75, py: 1.25, borderBottom: 1, borderColor: "surface.border" }}>
            <Typography variant="subtitle2" sx={{ color: "text.secondary" }}>Versions in the fleet</Typography>
          </Box>
          {fleet.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 1.75 }}>
              No devices registered.
            </Typography>
          ) : (
            <Box sx={{ px: 1.75, py: 1 }}>
              {fleet.map(([version, count]) => {
                const total = fleet.reduce((sum, [, c]) => sum + c, 0) || 1;
                const known = version !== "unknown";
                return (
                  <Box key={version} component={RouterLink} to="/devices" sx={{ display: "block", textDecoration: "none", color: "inherit", py: 0.85 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, alignItems: "baseline" }}>
                      <Typography variant="caption" sx={{ color: known ? "text.primary" : "text.disabled" }} noWrap>
                        {version}
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                        {count}
                      </Typography>
                    </Box>
                    <Box sx={{ mt: 0.6, height: 4, bgcolor: "surface.border" }}>
                      <Box
                        sx={(t) => ({
                          height: "100%",
                          width: `${(count / total) * 100}%`,
                          bgcolor: known ? t.palette.board.amber : t.palette.text.disabled,
                        })}
                      />
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
          <Typography color="text.secondary" sx={{ display: "block", p: 1.75, pt: 1, fontSize: 12, lineHeight: 1.55 }}>
            Only one release can be active at a time. Deactivating it stops further rollout immediately, though screens that already installed it stay on that version until you publish a newer build.
          </Typography>
        </Paper>
      </Box>

      <Dialog open={uploadOpen} onClose={upload.isPending ? undefined : () => setUploadOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload player release</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "grid", gap: 2, pt: 0.5 }}>
            <Button variant="outlined" component="label" startIcon={<UploadFileRoundedIcon />} sx={{ justifyContent: "flex-start" }}>
              {file ? `${file.name} (${formatBytes(file.size)})` : "Choose APK file"}
              <input type="file" hidden accept=".apk,application/vnd.android.package-archive" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </Button>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
              <TextField label="Version name" placeholder="1.4.0" value={versionName} onChange={(e) => setVersionName(e.target.value)} />
              <TextField label="Version code" type="number" placeholder="14" value={versionCode} onChange={(e) => setVersionCode(e.target.value)} helperText="Must be higher than what devices run" />
            </Box>
            <TextField label="Release notes" multiline minRows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              <FormControlLabel control={<Switch checked={activate} onChange={(e) => setActivate(e.target.checked)} />} label="Make this the active release" />
              <FormControlLabel control={<Switch checked={mandatory} onChange={(e) => setMandatory(e.target.checked)} />} label="Mandatory" />
            </Box>
            {upload.isPending && <LinearProgress variant="determinate" value={progress * 100} />}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setUploadOpen(false)} disabled={upload.isPending}>
            Cancel
          </Button>
          <Button variant="contained" onClick={submit} disabled={upload.isPending || !file || !versionName.trim() || !/^\d+$/.test(versionCode)}>
            {upload.isPending ? `Uploading ${Math.round(progress * 100)}%` : "Upload"}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete release?"
        message={deleteTarget ? `Release ${deleteTarget.version_name} (build ${deleteTarget.version_code}) will be removed and its APK archived on the server.` : ""}
        loading={remove.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          remove.mutate(deleteTarget.id, {
            onSuccess: () => enqueueSnackbar("Release deleted", { variant: "success" }),
            onError: (e) => enqueueSnackbar((e as Error).message, { variant: "error" }),
            onSettled: () => setDeleteTarget(null),
          });
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
}
