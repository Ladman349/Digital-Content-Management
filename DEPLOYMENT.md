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
| `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` | Optional. Creates the first administrator at startup while no user exists, which turns sign-in on (see Section 6) | unset; remove the password after first sign-in |
| `SESSION_TTL_DAYS` | How long a CMS sign-in lasts without being used | `30` |

### React CMS (Vercel)
| Variable | Description | Recommended Production Value |
| :--- | :--- | :--- |
| `VITE_API_URL` | Target FastAPI gateway (include `/api/v1` prefix) | `https://api.grovitai.com/api/v1` |
| `VITE_ADMIN_API_KEY` | Legacy. Leave **unset** once user accounts are in use (see Section 6) | unset |

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
   python migrate_accounts.py       # adds users, clients, sessions and per-client ownership
   python migrate_reports.py        # adds the proof-of-play tables
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

The same APK runs on any Android 7+ device, not only TVs: neither Leanback nor a touchscreen is
required, and the status screen scales its type and spacing to the window (compact on phones and
small boxes, medium on tablets, 10-foot on TVs and large tablets). Content itself always fills the
screen. The CMS on Vercel is installable too — on a phone, open it in the browser and choose
**Add to Home Screen**; it launches full screen with the board's own colours. For a real
native controller app on phones (Android APK, iOS via TestFlight) see `docs/MOBILE_APPS.md`.

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
guards below are opt-in, and the order you enable them in matters. Until Step 1 is done, anyone who
can reach the CMS address controls every screen.

### Step 1: Turn on sign-in (safe to do immediately)

People sign in to the CMS and the phone apps with an email and a password. There are two kinds of
account:

| Role | Sees | Can also |
| :--- | :--- | :--- |
| **Administrator** | Everything, across every client | Manage users and clients, publish player updates, hand screens to clients |
| **Client user** | Only the screens, media, playlists and schedules of their own client | Nothing outside it. Another client's rows answer *404 Not Found*, never *403* |

Sign-in is **switched on by creating the first administrator**. Until that account exists the API
behaves exactly as it did before accounts, which is what makes the upgrade safe. There are three
ways to create it; pick one:

1. **In the CMS (simplest).** Open **Accounts**, which shows a "Sign-in is off" notice, and create
   your own administrator there. It takes effect at once: the CMS returns to the sign-in screen and
   you sign in with the account you just made. The password is typed into the CMS over HTTPS and
   goes nowhere else.
2. **From the hosting dashboard.** Set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` on
   the backend and restart it. The account is created only while the users table is empty, so the
   variables can never reset or resurrect an account later. Delete `BOOTSTRAP_ADMIN_PASSWORD` once
   you have signed in and changed the password.
3. **From a terminal with database access:** `python manage_users.py create-admin you@example.com "Your Name"`.
   The same tool recovers a locked-out operator: `python manage_users.py reset-password you@example.com`.

Screens are untouched throughout: players authenticate with their device token, never a user
account, so turning sign-in on cannot take a screen dark.

**Then, for each client:** Accounts → Clients → **New client**; on the Screens page tick their
screens and press **Hand over** (or open one screen and change **Client → Belongs to**). The dialog
lists what will travel with the screens — the playlists, media and schedules only they use — and
what has to stay because a screen that is not being handed over still uses it, with the reason.
Nothing stops playing either way. Handing over all of a client's screens together moves what they
share between them. Anything that stayed can still be moved by hand with the same **Belongs to**
control in the media, playlist and schedule inspectors. Finally Accounts → Users → **New user** with
the role *Client user*. New screens always register belonging to nobody, so handing a screen
over is a deliberate step by an administrator. The **Client** control in the top bar lets an
administrator work *as* one client: every board narrows to that client and anything created
belongs to them.

How it is built, for whoever maintains it:

* Passwords are hashed with scrypt. Sessions are opaque random tokens and the database stores only
  their SHA-256, so neither a database leak nor the default `SECRET_KEY` lets anyone forge a session.
  They last `SESSION_TTL_DAYS` (default 30) and slide forward while in use.
* Five wrong passwords for one email, or thirty from one address, block further attempts for fifteen
  minutes. Every failure returns the same message, so the form cannot be used to discover who has an
  account.
* The last active administrator cannot be deleted, disabled or demoted, and nobody can remove their
  own access.
* A user's sessions end immediately when they are disabled, deleted, or given a new password.
* Separation between clients is decided in one file, `backend/app/core/tenancy.py`, and attacked by
  `backend/tests/test_tenant_isolation.py`, which plays a client user reaching for another client's
  and the operator's rows through every route. Links follow the same rule as rows: when an
  administrator puts a client's playlist or schedule on a screen the client does not own, the client
  is never shown that screen and saving does not remove it; media or a playlist an administrator
  attached stays editable around, but the client cannot attach more that is not theirs.
* What accounts do **not** cover: a screen fetches its playlist and media knowing only its id until
  Step 2 below is enabled, and media files sit in a public storage bucket under unguessable names.
  Neither lets one client browse another's content, but treat media as unlisted rather than secret.
* `migrate_accounts.py` adds the schema (also applied at startup). It enables row-level security on
  `users`, `user_sessions` and `clients`: without that, Supabase's auto-generated REST API would
  serve password hashes to anyone holding the project's public anon key.

`ADMIN_API_KEY` still works as a platform-administrator credential for scripts and support tooling
(`X-Admin-Key` or `Authorization: Bearer <key>`). **Do not set `VITE_ADMIN_API_KEY` once accounts
are in use:** it is baked into the browser bundle, so it would make every visitor an administrator,
sign-in screen or not.

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
| Devices, media, playlists and schedules (list/create/update/delete) | A signed-in user, narrowed to their client; or the admin key |
| OTA upload and activation, `/users`, `/clients` | A signed-in **administrator**, or the admin key |
| `POST /auth/login`, `GET /auth/status` | Open by design (sign-in is rate-limited) |
| `GET /devices/{id}/current-playlist`, `GET /devices/{id}/status`, `POST /devices/heartbeat` | That device's token |
| `GET /media/{id}/download`, `GET /app-updates/check`, `GET /app-updates/download/...` | Any valid device token, or the admin key |
| `POST /devices/register`, `GET /app-updates/ping`, `/health`, `/ready` | Open by design |

---

## 6a. Proof-of-play reports

The **Reports** page answers "what played, on which screen, when, and how many times", with a CSV
export for invoicing or for sending to an advertiser.

* **It starts with player 1.3.0.** From that build each screen records every item it shows and
  delivers the record every five minutes. Publish 1.3.0 on the Updates page; a screen begins counting
  as soon as it has updated, and earlier builds simply report nothing. A screen that is offline keeps
  up to about six days of plays on disk and delivers them when it is back.
* **What is kept** is one counter per screen, file, playlist and hour, not a row per play: a
  ten-second item plays 8,640 times a day, and hourly counters answer every question the page asks at
  a few hundred rows per screen per day. Times are Indian time. A TV with a wrong clock is corrected
  on arrival, and a batch that is sent twice is counted once.
* **Who sees what.** An administrator sees everything, or one client with the top-bar Client control.
  A client sees plays **on their screens** and plays **of their media wherever it ran**, which is what
  an advertiser on the operator's screens needs. History follows a handover, and survives deleting
  the screen or the file.
* **How far to trust it.** Until Step 2 of Section 6 (`REQUIRE_DEVICE_AUTH`) is on, a screen is
  identified by its id alone, so someone who knew a screen's id could post plays that never happened.
  Turn device tokens on before the numbers are used for billing.
* The tables (`play_stats`, `play_batches`) are added at startup; `python migrate_reports.py --check`
  confirms they exist.

---

## 7. Security Roadmap

Section 6 covers what is implemented. What remains:

* **Audit trail and self-service for accounts.** Accounts, roles and per-client separation are in
  place (Section 6), but nothing records who changed what, and a forgotten password is reset by an
  administrator rather than by email. Both need an outbound mail service first.
* **Screen enrolment per client.** A new screen registers belonging to nobody and an administrator
  hands it over. A pairing code a client could enter themselves would remove that step.
* **Enrollment control.** `POST /devices/register` must stay open so a new screen can obtain its
  token, which means anyone who can reach the API can create device records. Rate-limit it at the
  edge, and consider a short-lived enrollment code entered during installation.
* **Signing key rotation.** The release keystore and its passwords were committed to git and should
  be treated as compromised. Rotating the key means every screen in the field needs a manual
  re-install, because Android rejects an update signed with a different key, and the OTA system
  cannot work around it. Do it before the fleet grows — the cost is linear in screens. Step-by-step
  procedure: [docs/KEY_ROTATION.md](docs/KEY_ROTATION.md).
* **Secret rotation.** `SECRET_KEY` still defaults to its placeholder value. It is unused today
  (sessions deliberately do not depend on it), but set it before anything starts signing with it.

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
