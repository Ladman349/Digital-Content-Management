# Digital Signage Platform - Cloud Production Deployment Guide

This guide details the steps required to transition the Digital Signage platform from local development environments to cloud services (Supabase, Railway, Vercel) and build the production Android player.

---

## 1. Cloud Architecture Flow

```mermaid
graph TD
    CMS[React CMS on Vercel] -->|Manage Playlists / Schedules| Backend[FastAPI on Railway]
    TV[Android Players] -->|Poll /current-playlist & Heartbeat| Backend
    Backend -->|Metadata / Auth| DB[(Supabase PostgreSQL)]
    Backend -->|Upload Media| Storage[(Supabase Storage Bucket)]
    TV -->|Direct Media Downloads| Storage
```

---

## 2. Environment Variables Specification

### FastAPI Backend (Railway)
| Variable | Description | Recommended Production Value |
| :--- | :--- | :--- |
| `APP_ENV` | Active environment state | `production` |
| `DATABASE_URL` | Supabase Postgres Connection URI | `postgresql://postgres.[id]:[pwd]@aws-0-us-east-1.pooler.supabase.com:5432/postgres` |
| `SUPABASE_URL` | Supabase endpoint URL | `https://[your-project-id].supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service key (bypasses RLS) | `[your-service-role-key]` |
| `SUPABASE_STORAGE_BUCKET` | Destination storage bucket name | `media` |
| `API_BASE_URL` | Public server domain endpoint | `https://api.grovitai.com` |
| `CORS_ALLOWED_ORIGINS` | Permitted cross-origin endpoints | `https://cms.grovitai.com` (Your Vercel Domain) |
| `SECRET_KEY` | Cryptographic signature salt | `[a-secure-random-hash]` |

### React CMS (Vercel)
| Variable | Description | Recommended Production Value |
| :--- | :--- | :--- |
| `VITE_API_URL` | Target FastAPI gateway (include `/api/v1` prefix) | `https://api.grovitai.com/api/v1` |

---

## 3. Infrastructure Deployment Steps

### Phase A: Database & Storage (Supabase)
1. **Create Project:** Initialize a new project in the [Supabase Dashboard](https://supabase.com).
2. **Import Database Schema:**
   * Dump your local database schema:
     ```bash
     pg_dump -h localhost -U postgres -d postgres --schema-only > schema.sql
     ```
   * Restore it on Supabase Postgres:
     * Navigate to **SQL Editor** in Supabase.
     * Paste the contents of `schema.sql` and click **Run**.
3. **Configure Media Bucket:**
   * Go to **Storage** -> **New Bucket**.
   * Name the bucket exactly `media` (or whatever `SUPABASE_STORAGE_BUCKET` is configured as).
   * Toggle **Public** to `ON` (allowing direct public downloads by players).

### Phase B: Backend Deployment (Railway)
1. Login to Railway, connect your Git repository, and select the `/backend` subdirectory.
2. Add all environment variables detailed in **Section 2**.
3. Railway automatically detects the Python project and starts it using the bundled `Procfile`:
   ```text
   web: uvicorn main:app --host 0.0.0.0 --port $PORT
   ```

### Phase C: CMS Deployment (Vercel)
1. Login to Vercel, import your Git repository, and choose the `/frontend` (React CMS) directory.
2. In **Environment Variables**, configure:
   * `VITE_API_URL = https://[your-railway-domain]/api/v1`
3. Click **Deploy**.

---

## 4. Android Production Build & Onboarding

### Compiling the Production APK
1. Open terminal in the `/android` directory.
2. Set your environment overrides (or add them inside `android/local.properties`):
   ```bash
   # Windows PowerShell
   $env:PROD_API_HOST="api.grovitai.com"
   $env:PROD_API_PORT="443"
   ./gradlew assembleProdRelease
   ```
3. Copy the compiled release APK from `android/app/build/outputs/apk/prod/release/app-prod-release.apk` onto the TV device and install it.

### Onboarding a New TV
1. Launch the app on the TV. It will display a **6-digit Pairing Code**.
2. Log into the React CMS, navigate to **Devices**, click **Register Device**, and enter:
   * The Pairing Code shown on screen.
   * A custom name (e.g. "Lobby-Main") and location descriptor.
3. The TV status will transition to **Playing** and start rendering the scheduled playlist.

---

## 5. Security & Authentication Roadmap

To secure device communication in the future, the following provisions have been designed into the `devices` schema:

* **API Keys / Device Tokens:** The `devices` table already contains a `deviceToken` column.
* **Authentication Activation:** 
  1. Add a pairing auth endpoint (`POST /api/v1/devices/authenticate`) returning a JWT signed with `SECRET_KEY`.
  2. Implement an interceptor inside `Retrofit` on Android to attach the token under the `Authorization: Bearer <deviceToken>` header.
  3. Enable a global dependency inject guard in FastAPI to validate JWTs in `device_router` and `device_playlist_router`.

---

## 6. Troubleshooting

* **Device is not registering:**
  * Verify the TV can reach the backend. Open a browser on the device and navigate to `https://[your-api-domain]/ready` to confirm.
  * Check the `X-Request-ID` in the backend logs to trace pairing command failures.
* **Media is not downloading:**
  * Ensure the Supabase Storage bucket is marked as **Public**.
  * Check if the device shows file errors. The Android download manager writes files directly using extensions; confirm storage permissions are valid.
* **Playlist is not updating:**
  * Verify the continuous sync polling job is running (occurs every 15 seconds by default).
  * Look for `"Periodic sync started"` and `"Periodic sync completed"` logs in Logcat.
