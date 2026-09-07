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
| `SUPABASE_APK_BUCKET` | Bucket holding player APKs for OTA (see Section 5) | `apks` |
| `OTA_MAX_UPLOAD_MB` | Maximum accepted APK upload size | `150` |
| `API_BASE_URL` | Public server domain endpoint | `https://api.grovitai.com` |
| `CORS_ALLOWED_ORIGINS` | Permitted cross-origin endpoints | `https://cms.grovitai.com` (Your Vercel Domain) |
| `SECRET_KEY` | Cryptographic signature salt | `[a-secure-random-hash]` |
| `ADMIN_API_KEY` | Requires a key on all CMS routes. Empty leaves the API open (see Section 6) | `[a-long-random-string]` |
| `REQUIRE_DEVICE_AUTH` | Requires players to send their device token. Enable only after the fleet is updated (see Section 6) | `false` initially |

### React CMS (Vercel)
| Variable | Description | Recommended Production Value |
| :--- | :--- | :--- |
| `VITE_API_URL` | Target FastAPI gateway (include `/api/v1` prefix) | `https://api.grovitai.com/api/v1` |
| `VITE_ADMIN_API_KEY` | Must match the backend's `ADMIN_API_KEY`. Only needed once that is set | `[same-as-backend]` |

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
4. **Configure APK Bucket:** repeat for a public bucket named `apks` (see Section 5). The bundled
   SQL script creates both buckets and their policies already.
5. **Run the migrations.** Both are idempotent, additive, and safe against a live database:
   ```bash
   python migrate_ota_storage.py    # adds app_updates.storage_uri (OTA durability)
   python migrate_fk_rules.py       # aligns foreign-key delete rules with the API's 409 guards
   ```
   `migrate_fk_rules.py --check` reports without changing anything, so it is safe to run in CI.

> Do **not** run `create_tables.py` against a populated database. It calls `drop_all()` first and
> will destroy your data despite the innocuous name.

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

Registration is automatic — there is no pairing code to type in. The player calls
`POST /api/v1/devices/register` on first launch, keyed on the device's Android ID, and the backend
mints the device record and its token.

1. Launch the app on the TV and make sure it has network access.
2. The status screen on the TV shows its **Device ID** (for example `TV-073D5AAB`) along with the
   device name, IP address and app version. Note the Device ID.
3. In the CMS, open **Devices**. The screen appears within a minute of its first heartbeat. Find it
   by the Device ID from step 2, then use the inspector panel to set a meaningful **name** and
   **location** (for example "Lobby-Main" / "Reception").
4. Give the screen something to play, either:
   * **Devices → Assign playlist**, which plays whenever no schedule is live; or
   * **Schedule → New schedule**, to play a published playlist during a daily time window.
5. The device status turns **Online** while heartbeats keep arriving (Online within 2 minutes of the
   last heartbeat, Idle up to 10 minutes, Offline beyond that).

> Re-installing or clearing the app's data creates a **new** Device ID. Delete the stale record in
> the CMS afterwards.

---

## 5. Over-the-Air (OTA) Player Updates

Once a screen is installed you will rarely touch it again, so new player builds are delivered over
the network. You upload a signed APK, mark it active, and every screen picks it up on its own.

### How it works

```mermaid
graph LR
    CMS[CMS: upload APK] --> API[FastAPI /app-updates]
    API --> Bucket[(Supabase 'apks' bucket)]
    TV[Player] -->|every 6h: GET /check?version_code=N| API
    API -->|apkUrl + sha256 + size| TV
    TV -->|GET /download/...| API
    API -->|307 redirect| Bucket
    Bucket -->|APK bytes| TV
    TV --> Verify[Verify sha256 + package + signature] --> Install[Install] --> Restart[Restart on new version]
```

The player asks for the currently active release and compares its **version code** with its own. A
release is only offered when its version code is strictly higher, so the version code must increase
with every build. The download is verified against the SHA-256 the server advertised, the APK's
package name and signing certificate are checked against the running app, and only then is it
installed. On a device-owner device the install is silent; otherwise Android shows its normal
installer prompt.

Checks run about 30 seconds after startup and every 6 hours thereafter, and are skipped while the
device is offline.

### One-time setup

1. **Create the APK bucket.** `migration_to_new_supabase.sql` already creates a public `apks` bucket
   with read, insert and delete policies. If your project predates that script, create a public
   bucket named `apks` by hand.
2. **Add the storage column.** Run once against the production database:
   ```bash
   python migrate_ota_storage.py
   ```
   It is additive and safe to re-run.
3. **Set the environment variables** on the backend:

   | Variable | Purpose | Default |
   | :--- | :--- | :--- |
   | `SUPABASE_APK_BUCKET` | Bucket holding player APKs | `apks` |
   | `OTA_MAX_UPLOAD_MB` | Rejects oversized uploads | `150` |
   | `API_BASE_URL` | Host used to build the download URL given to players | Railway domain |

> **Without Supabase configured the APK is written to the backend's local disk, which Railway wipes
> on every redeploy.** The CMS marks such releases **Not durable**, and the upload fails loudly
> rather than silently if the bucket is configured but unreachable.

### Publishing a release

1. Bump `versionCode` (and `versionName`) in `android/app/build.gradle.kts`. The version code must be
   higher than anything already in the field.
2. Build a signed release APK:
   ```bash
   ./gradlew assembleProdRelease
   ```
3. In the CMS open **App updates → Upload APK**, choose the file, and enter the same version name and
   version code. Add release notes so the fleet history is readable later.
4. Tick **Make this the active release** to start the rollout. Leave it unticked to stage the build
   and activate it later.
5. Watch **Versions in the fleet** on the same page. Screens report their version on each heartbeat,
   so the list shifts to the new build as devices update.

Mark a release **Mandatory** to record that it must not be skipped. Today the player installs both
mandatory and optional updates as soon as they are ready; the flag exists so the behaviour can be
split later without a protocol change.

### Rolling back

Deactivating the active release stops the rollout immediately, since players are only ever offered
the active one. It does **not** downgrade screens that already updated: Android will not install an
APK whose version code is lower than the installed one. To move the fleet back, build a **new**
release with a higher version code containing the older code, and activate that.

---

## 6. Securing the API

The API ships **open by default** so an existing deployment keeps working after upgrading. Both
guards below are opt-in, and the order you enable them in matters.

### Step 1: Lock the CMS routes (safe to do immediately)

Set `ADMIN_API_KEY` on the backend to any long random string, and the matching
`VITE_ADMIN_API_KEY` on the CMS. Every management route then requires the key, sent as
`X-Admin-Key` or `Authorization: Bearer <key>`.

```bash
# generate one
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

This closes the most serious hole: without it, anyone who can reach the API can upload and activate
a player APK, which installs on every screen. Player routes are unaffected, so screens keep running
throughout.

> The CMS key travels in the browser bundle, so it is a deployment guard rather than user
> authentication. Anyone who can load the CMS can read it. Keep the CMS behind SSO or a VPN, and
> treat per-user login as the follow-up work.

### Step 2: Require device tokens (only when the fleet is ready)

`REQUIRE_DEVICE_AUTH=true` makes players prove they hold a device's token rather than merely knowing
its id.

**Check before enabling.** Players built before this change sent a hardcoded placeholder token. A
device that cannot authenticate also cannot download the OTA update that would fix it, so enabling
this too early strands those screens permanently and they must be re-imaged by hand.

1. Publish a player release that sends the real token (any build from this revision onward).
2. Wait until **Versions in the fleet** on the App updates page shows every screen on that build or
   newer.
3. Only then set `REQUIRE_DEVICE_AUTH=true`.

Device registration (`POST /devices/register`) stays open regardless, because that call is how a new
screen obtains its token in the first place. It is the remaining unauthenticated write, so it is
worth rate-limiting at the edge.

### What each guard covers

| Route group | Guard |
| :--- | :--- |
| Devices list/create/update/delete, playlists, schedules, media management, OTA upload and activation | Admin key |
| `GET /devices/{id}/current-playlist`, `GET /devices/{id}/status`, `POST /devices/heartbeat` | That device's token |
| `GET /media/{id}/download`, `GET /app-updates/check`, `GET /app-updates/download/...` | Any valid device token, or the admin key |
| `POST /devices/register`, `GET /app-updates/ping`, `/health`, `/ready` | Open by design |

---

## 7. Security Roadmap

Section 6 covers what is implemented. What remains:

* **Per-user login for the CMS.** The admin key is a single shared secret embedded in the browser
  bundle. It cannot identify who made a change, cannot be revoked for one person, and is readable by
  anyone who can load the CMS. Real accounts with sessions, roles and an audit trail are the natural
  next step. `SECRET_KEY` is already provisioned for signing sessions or JWTs.
* **Enrollment control.** `POST /devices/register` must stay open so a new screen can obtain its
  token, which means anyone who can reach the API can create device records. Rate-limit it at the
  edge, and consider a short-lived enrollment code entered during installation.
* **Signing key rotation.** The release keystore and its passwords were committed to git and should
  be treated as compromised. Rotating the key means every screen in the field needs a manual
  re-install, because Android rejects an update signed with a different key. Do it before the fleet
  grows.
* **Secret rotation.** `SECRET_KEY` still defaults to its placeholder value. It is unused today, but
  set it before anything starts signing with it.

---

## 8. Troubleshooting

* **Device is not registering:**
  * Verify the TV can reach the backend. Open a browser on the device and navigate to `https://[your-api-domain]/ready` to confirm.
  * Check the `X-Request-ID` in the backend logs to trace pairing command failures.
* **Media is not downloading:**
  * Ensure the Supabase Storage bucket is marked as **Public**.
  * Check if the device shows file errors. The Android download manager writes files directly using extensions; confirm storage permissions are valid.
* **Playlist is not updating:**
  * Verify the continuous sync polling job is running (occurs every 15 seconds by default).
  * Look for `"Periodic sync started"` and `"Periodic sync completed"` logs in Logcat.
