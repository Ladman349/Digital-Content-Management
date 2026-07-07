import { Box, MenuItem, TextField, Typography } from "@mui/material";
import FormatListBulletedRoundedIcon from "@mui/icons-material/FormatListBulletedRounded";
import type { Playlist } from "../../types/playlist";

interface Props {
  playlists: Playlist[];
  value: string;
  onChange: (id: string) => void;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
}

function getPlaylistLabel(p: Playlist): string {
  if (p.status === "Draft") return `${p.name} (Draft – Cannot be scheduled)`;
  if (p.status === "Archived") return `${p.name} (Archived – Cannot be scheduled)`;
  return `${p.name} (${p.items.length} items)`;
}

export default function PlaylistSelector({ playlists, value, onChange, error, helperText, disabled }: Props) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Typography sx={{ fontWeight: 600, fontSize: 14, color: "#1E293B", display: "flex", alignItems: "center", gap: 1 }}>
        <FormatListBulletedRoundedIcon sx={{ fontSize: 18, color: "#F59E0B" }} />
        Select Playlist
      </Typography>
      <TextField
        select
        fullWidth
        value={value}
        onChange={(e) => onChange(e.target.value)}
        error={error}
        helperText={helperText}
        disabled={disabled}
        sx={{ "& .MuiOutlinedInput-root": { borderRadius: "12px" } }}
      >
        <MenuItem value="" disabled>Select a playlist to schedule</MenuItem>
        {playlists.map(p => (
          <MenuItem
            key={p.id}
            value={p.id}
            disabled={p.status !== "Published"}
            sx={p.status !== "Published" ? { color: "#94A3B8", fontStyle: "italic" } : {}}
          >
            {getPlaylistLabel(p)}
          </MenuItem>
        ))}
      </TextField>
    </Box>
  );
}
