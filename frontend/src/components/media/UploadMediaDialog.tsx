import { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";

import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";
import InsertDriveFileRoundedIcon from "@mui/icons-material/InsertDriveFileRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import IconButton from "@mui/material/IconButton";

interface Props {
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (files: File[]) => void;
}

export default function UploadMediaDialog({
  open,
  loading = false,
  onClose,
  onSubmit,
}: Props) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles((prev) => [...prev, ...Array.from(e.target.files as FileList)]);
    }
    // reset input so the same file can be selected again if removed
    e.target.value = "";
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (selectedFiles.length > 0) {
      onSubmit(selectedFiles);
      setSelectedFiles([]);
    }
  };

  const handleClose = () => {
    setSelectedFiles([]);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : handleClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: "20px",
          },
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: "12px",
              bgcolor: "#E0F2FE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CloudUploadRoundedIcon sx={{ color: "#0EA5E9" }} />
          </Box>

          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 20 }}>
              Upload Media
            </Typography>
            <Typography sx={{ color: "#64748B", fontSize: 13, mt: 0.25 }}>
              Add images or videos to your media library
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ pt: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          
          <Button
            variant="outlined"
            component="label"
            startIcon={<CloudUploadRoundedIcon />}
            sx={{
              borderStyle: "dashed",
              borderWidth: 2,
              borderRadius: "16px",
              py: 4,
              color: "#334155",
              borderColor: "#E2E8F0",
              textTransform: "none",
              fontWeight: 600,
              fontSize: 16,
              "&:hover": {
                borderStyle: "dashed",
                borderWidth: 2,
                borderColor: "#BAE6FD",
                bgcolor: "#F0F9FF",
              }
            }}
          >
            Click to Browse Files
            <input
              type="file"
              hidden
              multiple
              accept="image/jpeg, image/png, image/webp, video/mp4, video/webm"
              onChange={handleFileChange}
            />
          </Button>

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography sx={{ fontWeight: 600, fontSize: 14, mb: 1.5, color: "#334155" }}>
                Selected Files ({selectedFiles.length})
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {selectedFiles.map((file, index) => (
                  <Box
                    key={`${file.name}-${index}`}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      p: 1.5,
                      borderRadius: "12px",
                      border: "1px solid #EEF2F7",
                      bgcolor: "#fff",
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, overflow: "hidden" }}>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: "8px",
                          bgcolor: "#F1F5F9",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <InsertDriveFileRoundedIcon sx={{ fontSize: 18, color: "#64748B" }} />
                      </Box>
                      <Box sx={{ overflow: "hidden" }}>
                        <Typography
                          sx={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#1E293B",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {file.name}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: "#64748B" }}>
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </Typography>
                      </Box>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={() => handleRemoveFile(index)}
                      sx={{ color: "#EF4444", "&:hover": { bgcolor: "#FEF2F2" } }}
                    >
                      <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button
          onClick={handleClose}
          disabled={loading}
          sx={{
            textTransform: "none",
            fontWeight: 600,
            borderRadius: "12px",
            px: 2.5,
            color: "#64748B",
          }}
        >
          Cancel
        </Button>

        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || selectedFiles.length === 0}
          sx={{
            textTransform: "none",
            fontWeight: 700,
            borderRadius: "12px",
            px: 3,
            background: "linear-gradient(135deg,#0EA5E9,#3B82F6)",
            boxShadow: "none",
            "&:hover": {
              background: "linear-gradient(135deg,#0284C7,#2563EB)",
            },
          }}
        >
          {loading ? "Uploading…" : "Upload Files"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
