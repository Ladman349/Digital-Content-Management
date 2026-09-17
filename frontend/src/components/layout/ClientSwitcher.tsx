import { Box, ButtonBase, ListItemText, Menu, MenuItem, Typography } from "@mui/material";
import UnfoldMoreRoundedIcon from "@mui/icons-material/UnfoldMoreRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { useClients } from "../../hooks/queries";

/**
 * Administrators only. Picks the client the whole CMS is working as: every board narrows to that
 * client's rows and anything created belongs to them, so an administrator setting up a client's
 * content sees exactly what the client will see. "All clients" is the operator's own view.
 *
 * Renders nothing until there is at least one client, so a single-tenant deployment never sees it.
 */
export default function ClientSwitcher() {
  const { isAdmin, scope, setScope } = useAuth();
  const { data: clients = [], isSuccess } = useClients(isAdmin);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const current = clients.find((c) => c.id === scope);

  // The remembered client was deleted (here or by another administrator): fall back to everything,
  // otherwise every board would be asking the server for a client that no longer exists.
  useEffect(() => {
    if (isSuccess && scope && !current) setScope("");
  }, [isSuccess, scope, current, setScope]);

  if (!isAdmin || clients.length === 0) return null;

  const pick = (id: string) => {
    setAnchor(null);
    if (id !== scope) setScope(id);
  };

  return (
    <>
      <ButtonBase
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-haspopup="menu"
        aria-label={`Working as ${current ? current.name : "all clients"}. Change client`}
        sx={(t) => ({
          flex: "none",
          maxWidth: { xs: 132, sm: 200 },
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          pl: 1.1,
          pr: 0.5,
          py: 0.55,
          borderRadius: 0.5,
          border: 1,
          borderColor: current ? t.palette.board.amber : t.palette.surface.borderStrong,
          color: current ? "text.primary" : "text.secondary",
          "&:hover": { backgroundColor: t.palette.surface.hover },
          "@media (pointer: coarse)": { py: 0.9 },
        })}
      >
        <Box sx={{ minWidth: 0, textAlign: "left", lineHeight: 1.1 }}>
          <Typography component="div" sx={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.17em", textTransform: "uppercase", color: "text.secondary" }}>
            Client
          </Typography>
          <Typography component="div" noWrap sx={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            {current ? current.name : "All"}
          </Typography>
        </Box>
        <UnfoldMoreRoundedIcon sx={{ fontSize: 16, flex: "none" }} />
      </ButtonBase>

      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}>
        <MenuItem onClick={() => pick("")} selected={!scope}>
          <ListItemText primary="All clients" secondary="Everything, including the operator's own" />
          {!scope && <CheckRoundedIcon fontSize="small" sx={{ ml: 2 }} />}
        </MenuItem>
        {clients.map((c) => (
          <MenuItem key={c.id} onClick={() => pick(c.id)} selected={c.id === scope}>
            <ListItemText primary={c.name} secondary={`${c.deviceCount} screen${c.deviceCount === 1 ? "" : "s"} · ${c.userCount} user${c.userCount === 1 ? "" : "s"}`} />
            {c.id === scope && <CheckRoundedIcon fontSize="small" sx={{ ml: 2 }} />}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
