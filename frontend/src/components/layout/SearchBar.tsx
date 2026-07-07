import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { InputBase, Paper, Snackbar, Alert } from "@mui/material";
import { useState } from "react";

export default function SearchBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setOpen(true);
    }
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <>
      <Paper
        component="form"
        onSubmit={handleSubmit}
        elevation={0}
        sx={{
          display: "flex",
          alignItems: "center",
          px: 2,
          width: 360,
          height: 48,
          bgcolor: "#F8FAFC",
          border: "1px solid #E5E7EB",
          borderRadius: 50,

          "&:hover": {
            borderColor: "#6C4CF1",
          },
        }}
      >
        <SearchRoundedIcon
          sx={{
            color: "#94A3B8",
            mr: 1,
          }}
        />

        <InputBase
          fullWidth
          placeholder="Search devices, media..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </Paper>
      
      <Snackbar
        open={open}
        autoHideDuration={4000}
        onClose={handleClose}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert onClose={handleClose} severity="info" sx={{ width: '100%', borderRadius: 2 }}>
          Global search across devices, media, and playlists is coming soon!
        </Alert>
      </Snackbar>
    </>
  );
}