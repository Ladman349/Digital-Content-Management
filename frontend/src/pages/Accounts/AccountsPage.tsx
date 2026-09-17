import { useMemo, useState, type FormEvent } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, TextField, Tooltip, Typography } from "@mui/material";
import PersonAddAltRoundedIcon from "@mui/icons-material/PersonAddAltRounded";
import DomainAddRoundedIcon from "@mui/icons-material/DomainAddRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import ManageAccountsRoundedIcon from "@mui/icons-material/ManageAccountsRounded";
import ApartmentRoundedIcon from "@mui/icons-material/ApartmentRounded";
import { useSnackbar } from "notistack";

import PageHeader from "../../components/ui/PageHeader";
import DataTable, { type Column } from "../../components/ui/DataTable";
import EmptyState from "../../components/ui/EmptyState";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import RowLead from "../../components/ui/RowLead";
import StatusChip from "../../components/ui/StatusChip";
import SearchField from "../../components/ui/SearchField";
import SegmentedFilter from "../../components/ui/SegmentedFilter";
import { useAuth } from "../../auth/AuthProvider";
import { useClients, useCreateClient, useCreateUser, useDeleteClient, useDeleteUser, useRenameClient, useUpdateUser, useUsers } from "../../hooks/queries";
import { PASSWORD_MIN_LENGTH, type Client, type User, type UserRole } from "../../types/account";
import { pluralize, relativeTime } from "../../utils/format";
import { useNow } from "../../hooks/useNow";
import { MONO } from "../../app/theme";

type Tab = "users" | "clients";

// Stable fallbacks, so "no data yet" does not look like a new list to every memo on each render.
const NO_USERS: User[] = [];
const NO_CLIENTS: Client[] = [];

// ── User form ──────────────────────────────────────────────────────────────
function UserDialog({ user, clients, isSelf, onClose }: { user: User | null; clients: Client[]; isSelf: boolean; onClose: () => void }) {
  const { enqueueSnackbar } = useSnackbar();
  const create = useCreateUser();
  const update = useUpdateUser();
  const editing = Boolean(user);

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<UserRole>(user?.role ?? (clients.length ? "client" : "admin"));
  const [clientId, setClientId] = useState(user?.clientId ?? "");
  const [active, setActive] = useState(user?.isActive ?? true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const busy = create.isPending || update.isPending;
  const passwordShort = password.length > 0 && password.length < PASSWORD_MIN_LENGTH;
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const ready = name.trim() && emailOk && (role === "admin" || clientId) && (editing ? !passwordShort : password.length >= PASSWORD_MIN_LENGTH);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setError(null);
    try {
      if (user) {
        await update.mutateAsync({
          id: user.id,
          data: {
            name: name.trim(),
            // Your own role and status are not yours to change; the server refuses it too.
            ...(isSelf ? {} : { role, clientId: role === "client" ? clientId : null, isActive: active }),
            ...(password ? { password } : {}),
          },
        });
        enqueueSnackbar(password ? "User updated and signed out everywhere" : "User updated", { variant: "success" });
      } else {
        await create.mutateAsync({ name: name.trim(), email: email.trim(), password, role, clientId: role === "client" ? clientId : null });
        enqueueSnackbar("User created. Give them their email and password.", { variant: "success" });
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <Box component="form" onSubmit={submit} noValidate autoComplete="off">
        <DialogTitle>{editing ? "Edit user" : "New user"}</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, pt: "12px !important" }}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!editing} fullWidth />
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={editing}
            helperText={editing ? "The email is how they sign in and cannot be changed." : "They sign in with this."}
            error={!editing && email.length > 0 && !emailOk}
            autoCapitalize="none"
            fullWidth
          />
          <TextField select label="Role" value={role} onChange={(e) => setRole(e.target.value as UserRole)} disabled={isSelf} fullWidth helperText={role === "admin" ? "Sees every client, manages accounts and player updates." : "Sees and controls one client's screens and content only."}>
            <MenuItem value="client" disabled={clients.length === 0}>
              Client user{clients.length === 0 ? " (add a client first)" : ""}
            </MenuItem>
            <MenuItem value="admin">Administrator</MenuItem>
          </TextField>
          {role === "client" && (
            <TextField select label="Client" value={clientId} onChange={(e) => setClientId(e.target.value)} disabled={isSelf} fullWidth>
              {clients.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            label={editing ? "New password (leave blank to keep)" : "Password"}
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={passwordShort}
            helperText={passwordShort ? `At least ${PASSWORD_MIN_LENGTH} characters.` : editing ? "Setting one signs them out on every device." : "Shown as you type so you can pass it on. They can change it after signing in."}
            autoComplete="new-password"
            slotProps={{ htmlInput: { style: { fontFamily: MONO } } }}
            fullWidth
          />
          {editing && !isSelf && (
            <TextField select label="Status" value={active ? "active" : "disabled"} onChange={(e) => setActive(e.target.value === "active")} fullWidth helperText={active ? " " : "A disabled user is signed out and cannot sign in."}>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="disabled">Disabled</MenuItem>
            </TextField>
          )}
          {error && (
            <Typography role="alert" variant="body2" color="error">
              {error}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={!ready || busy}>
            {busy ? "Saving…" : editing ? "Save" : "Create user"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

// ── Client form ────────────────────────────────────────────────────────────
function ClientDialog({ client, onClose }: { client: Client | null; onClose: () => void }) {
  const { enqueueSnackbar } = useSnackbar();
  const create = useCreateClient();
  const rename = useRenameClient();
  const [name, setName] = useState(client?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const busy = create.isPending || rename.isPending;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setError(null);
    try {
      if (client) await rename.mutateAsync({ id: client.id, name: name.trim() });
      else await create.mutateAsync(name.trim());
      enqueueSnackbar(client ? "Client renamed" : "Client added", { variant: "success" });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <Box component="form" onSubmit={submit} noValidate>
        <DialogTitle>{client ? "Rename client" : "New client"}</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: 2, pt: "12px !important" }}>
          <TextField label="Client name" value={name} onChange={(e) => setName(e.target.value)} autoFocus fullWidth helperText="The business whose screens these are." />
          {error && (
            <Typography role="alert" variant="body2" color="error">
              {error}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={!name.trim() || busy}>
            {busy ? "Saving…" : client ? "Rename" : "Add client"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function AccountsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const { status, user: me, setScope } = useAuth();
  const users = useUsers();
  const clients = useClients();
  const deleteUser = useDeleteUser();
  const deleteClient = useDeleteClient();

  const [tab, setTab] = useState<Tab>("users");
  const [query, setQuery] = useState("");
  const [userDialog, setUserDialog] = useState<{ user: User | null } | null>(null);
  const [clientDialog, setClientDialog] = useState<{ client: Client | null } | null>(null);
  const [removeUser, setRemoveUser] = useState<User | null>(null);
  const [removeClient, setRemoveClient] = useState<Client | null>(null);

  const userRows = users.data ?? NO_USERS;
  const clientRows = clients.data ?? NO_CLIENTS;
  const now = useNow(60_000);
  const q = query.trim().toLowerCase();

  const shownUsers = useMemo(
    () => (q ? userRows.filter((u) => [u.name, u.email, u.clientName, u.role].some((f) => f?.toLowerCase().includes(q))) : userRows),
    [userRows, q],
  );
  const shownClients = useMemo(() => (q ? clientRows.filter((c) => c.name.toLowerCase().includes(q)) : clientRows), [clientRows, q]);

  const userColumns: Column<User>[] = [
    {
      key: "name",
      label: "User",
      lead: true,
      render: (u) => <RowLead name={u.name} sub={u.email} muted={!u.isActive} />,
    },
    {
      key: "role",
      label: "Access",
      onCard: true,
      width: 220,
      render: (u) =>
        u.role === "admin" ? (
          <StatusChip label="Administrator" tone="primary" dot={false} />
        ) : (
          <Typography component="span" sx={{ fontSize: 12.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {u.clientName ?? "—"}
          </Typography>
        ),
    },
    { key: "status", label: "Status", onCard: true, width: 120, render: (u) => <StatusChip label={u.isActive ? "Active" : "Disabled"} tone={u.isActive ? "success" : "neutral"} /> },
    {
      key: "lastLogin",
      label: "Last sign-in",
      onCard: true,
      width: 150,
      hideBelow: "md",
      render: (u) => (
        <Typography component="span" sx={{ fontFamily: MONO, fontSize: 11.5, color: u.lastLoginAt ? "text.primary" : "text.disabled" }}>
          {u.lastLoginAt ? relativeTime(u.lastLoginAt, now) : "never"}
        </Typography>
      ),
    },
    {
      key: "actions",
      label: "",
      width: 96,
      align: "right",
      render: (u) => (
        <Box sx={{ display: "inline-flex" }} onClick={(e) => e.stopPropagation()}>
          <Tooltip title="Edit">
            <IconButton onClick={() => setUserDialog({ user: u })} aria-label={`Edit ${u.name}`}>
              <EditOutlinedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={u.id === me?.id ? "You cannot delete your own account" : "Delete"}>
            <span>
              <IconButton onClick={() => setRemoveUser(u)} disabled={u.id === me?.id} aria-label={`Delete ${u.name}`}>
                <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      ),
    },
  ];

  const clientColumns: Column<Client>[] = [
    { key: "name", label: "Client", lead: true, render: (c) => <RowLead name={c.name} sub={c.id} /> },
    { key: "screens", label: "Screens", onCard: true, width: 110, align: "right", render: (c) => <Count n={c.deviceCount} /> },
    { key: "users", label: "Users", onCard: true, width: 100, align: "right", render: (c) => <Count n={c.userCount} /> },
    { key: "media", label: "Media", width: 100, align: "right", hideBelow: "md", render: (c) => <Count n={c.mediaCount} /> },
    { key: "playlists", label: "Playlists", width: 110, align: "right", hideBelow: "md", render: (c) => <Count n={c.playlistCount} /> },
    {
      key: "actions",
      label: "",
      width: 132,
      align: "right",
      render: (c) => (
        <Box sx={{ display: "inline-flex" }} onClick={(e) => e.stopPropagation()}>
          <Tooltip title="Work as this client">
            <IconButton
              onClick={() => {
                setScope(c.id);
                enqueueSnackbar(`Now working as ${c.name}. Switch back from the Client control in the top bar.`, { variant: "info" });
              }}
              aria-label={`Work as ${c.name}`}
            >
              <VisibilityRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Rename">
            <IconButton onClick={() => setClientDialog({ client: c })} aria-label={`Rename ${c.name}`}>
              <EditOutlinedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton onClick={() => setRemoveClient(c)} aria-label={`Delete ${c.name}`}>
              <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  const admins = userRows.filter((u) => u.role === "admin" && u.isActive).length;

  return (
    <Box>
      {status === "open" && (
        <Box role="note" sx={{ mb: 2, p: 2, bgcolor: "board.cell", borderLeft: 3, borderColor: "board.amber" }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: "primary.main" }}>Sign-in is off</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 720, lineHeight: 1.6 }}>
            Anyone who can open this address controls every screen. Create your own administrator account below to turn sign-in on. It takes effect immediately: you will be asked to sign in with it, and so will the
            phone apps. Screens keep playing throughout.
          </Typography>
        </Box>
      )}

      <PageHeader
        title="Accounts"
        search={<SearchField value={query} onChange={setQuery} placeholder={tab === "users" ? "Search users" : "Search clients"} />}
        filters={
          <SegmentedFilter<Tab>
            ariaLabel="Accounts view"
            value={tab}
            onChange={(t) => {
              setTab(t);
              setQuery("");
            }}
            options={[
              { value: "users", label: "Users", count: userRows.length },
              { value: "clients", label: "Clients", count: clientRows.length },
            ]}
          />
        }
        meta={tab === "users" ? <span>{pluralize(admins, "administrator")}</span> : <span>{pluralize(clientRows.reduce((n, c) => n + c.deviceCount, 0), "screen")} assigned</span>}
        actions={
          tab === "users" ? (
            <Button variant="contained" startIcon={<PersonAddAltRoundedIcon />} onClick={() => setUserDialog({ user: null })}>
              New user
            </Button>
          ) : (
            <Button variant="contained" startIcon={<DomainAddRoundedIcon />} onClick={() => setClientDialog({ client: null })}>
              New client
            </Button>
          )
        }
      />

      {tab === "users" ? (
        <DataTable<User>
          columns={userColumns}
          rows={shownUsers}
          rowKey={(u) => u.id}
          loading={users.isLoading}
          error={users.error ? (users.error as Error).message : null}
          onRetry={() => users.refetch()}
          noun="users"
          onRowClick={(u) => setUserDialog({ user: u })}
          rowDim={(u) => !u.isActive}
          emptyState={
            <EmptyState
              icon={ManageAccountsRoundedIcon}
              title={q ? "No users match" : "No accounts yet"}
              description={q ? undefined : "Start with your own administrator account. Then add a client, and a user for each person at that client who should control its screens."}
              actionLabel={q ? undefined : "Create administrator"}
              onAction={q ? undefined : () => setUserDialog({ user: null })}
            />
          }
        />
      ) : (
        <DataTable<Client>
          columns={clientColumns}
          rows={shownClients}
          rowKey={(c) => c.id}
          loading={clients.isLoading}
          error={clients.error ? (clients.error as Error).message : null}
          onRetry={() => clients.refetch()}
          noun="clients"
          emptyState={
            <EmptyState
              icon={ApartmentRoundedIcon}
              title={q ? "No clients match" : "No clients yet"}
              description={q ? undefined : "A client is a business whose screens you run. Add one, hand it screens from the Screens page, then give its people a sign-in. Until then everything belongs to you, the operator."}
              actionLabel={q ? undefined : "New client"}
              onAction={q ? undefined : () => setClientDialog({ client: null })}
            />
          }
        />
      )}

      {userDialog && <UserDialog user={userDialog.user} clients={clientRows} isSelf={Boolean(userDialog.user && userDialog.user.id === me?.id)} onClose={() => setUserDialog(null)} />}
      {clientDialog && <ClientDialog client={clientDialog.client} onClose={() => setClientDialog(null)} />}

      <ConfirmDialog
        open={Boolean(removeUser)}
        title="Delete user?"
        message={removeUser ? `${removeUser.name} (${removeUser.email}) will be signed out and will no longer be able to sign in. Nothing they created is removed.` : ""}
        loading={deleteUser.isPending}
        onConfirm={() => {
          if (!removeUser) return;
          deleteUser.mutate(removeUser.id, {
            onSuccess: () => enqueueSnackbar("User deleted", { variant: "success" }),
            onError: (e) => enqueueSnackbar((e as Error).message, { variant: "error" }),
            onSettled: () => setRemoveUser(null),
          });
        }}
        onClose={() => setRemoveUser(null)}
      />
      <ConfirmDialog
        open={Boolean(removeClient)}
        title="Delete client?"
        message={removeClient ? `${removeClient.name} can only be deleted once it has no users, screens or content left.` : ""}
        loading={deleteClient.isPending}
        onConfirm={() => {
          if (!removeClient) return;
          deleteClient.mutate(removeClient.id, {
            onSuccess: () => enqueueSnackbar("Client deleted", { variant: "success" }),
            onError: (e) => enqueueSnackbar((e as Error).message, { variant: "error" }),
            onSettled: () => setRemoveClient(null),
          });
        }}
        onClose={() => setRemoveClient(null)}
      />
    </Box>
  );
}

function Count({ n }: { n: number }) {
  return (
    <Typography component="span" sx={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: n ? "text.primary" : "text.disabled" }}>
      {n}
    </Typography>
  );
}
