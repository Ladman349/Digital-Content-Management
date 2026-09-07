# Signage CMS (web app)

React + TypeScript + Vite front end for the digital signage platform. It manages screens, media,
playlists, schedules and player releases against the FastAPI backend.

## Running locally

```bash
npm install
npm run dev
```

The dev server listens on <http://localhost:5173>.

### Pointing at a backend

`VITE_API_URL` selects the API. The client normalises the value, so `http://localhost:8000` and
`http://localhost:8000/api/v1` both work — the `/api/v1` suffix is appended when missing.

| File | Purpose |
| :--- | :--- |
| `.env` | Committed default, points at the deployed backend |
| `.env.local` | Your machine only, git-ignored, overrides `.env` |

For local development create `.env.local` with:

```text
VITE_API_URL=http://localhost:8000/api/v1
```

## Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check with `tsc -b` and build for production |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |

## Layout

```text
src/
  api/          fetch wrapper, error parsing, upload-with-progress helper
  app/          MUI theme and light/dark mode provider
  components/
    layout/     app shell, sidebar, top bar, command palette
    ui/         shared primitives (DataTable, DetailPanel, KpiTile, …)
  constants/    navigation definitions
  hooks/        React Query hooks, URL-state and playback-resolution helpers
  pages/        one folder per route
  services/     one module per backend resource
  types/        API response and payload types
  utils/        formatting, media and schedule helpers
```

### Conventions

- Every list page follows the same shape: a compact header with counts and primary actions, a filter
  row, a dense table (or grid), and a right-hand inspector panel driven by `?select=<id>` in the URL.
- Server state lives in React Query only; there is no client-side store. Lists poll (devices every
  15s, everything else every 60s) so the CMS reflects player heartbeats without a manual refresh.
- `usePlaybackMap` mirrors the backend's playlist resolution (highest-priority live schedule, then
  the direct device assignment) so the UI can show what each screen should be playing and flag
  screens that report something different.
