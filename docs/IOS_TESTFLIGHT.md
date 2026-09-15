# Signage CMS on iPhone and iPad — TestFlight

The CMS ships to iOS as a native shell around the same web bundle Vercel serves. The project
lives in `frontend/ios` (Capacitor), and GitHub Actions builds, signs and uploads it from a macOS
runner, so no Mac is needed. This document is the one-time setup and the release routine.

What it is **not**: a player. Screens run the Android app under `/android`; an Apple TV player
would be a separate tvOS project.

## 1. One-time setup on Apple's side

1. **Apple Developer Program** — enrol at <https://developer.apple.com/programs/enroll/> (US$99 a
   year, usually approved within 48 hours). Enrol as an organisation if the app will be published
   under the company name; that needs a D-U-N-S number and takes longer.
2. **Team ID** — after enrolment, <https://developer.apple.com/account> → Membership details.
   Ten characters, e.g. `A1B2C3D4E5`. This becomes the secret `APPLE_TEAM_ID`.
3. **App ID** — Certificates, Identifiers & Profiles → Identifiers → **+** → App IDs → App.
   Bundle ID **explicit** `com.grovitai.signage` (it must match `appId` in
   `frontend/capacitor.config.ts`). No capabilities are needed.
4. **App record** — <https://appstoreconnect.apple.com> → Apps → **+** → New App. Platform iOS,
   name "Signage CMS", primary language English, bundle ID the one above, SKU `signage-cms`.
5. **App Store Connect API key** — Users and Access → Integrations → App Store Connect API →
   Team Keys → **+**. Name `github-actions`, role **App Manager**. Download the `.p8` **once**
   (Apple never shows it again). Note the **Issuer ID** at the top of the page and the **Key ID**
   of the row. These become `APPSTORE_ISSUER_ID`, `APPSTORE_KEY_ID` and `APPSTORE_PRIVATE_KEY`
   (the whole text of the `.p8` file).

## 2. Distribution certificate — made on Windows

Apple signs with an *Apple Distribution* certificate whose private key must be on the build
machine. It is normally created in Xcode, but OpenSSL does the same job on Windows. Run these in
PowerShell from any folder **outside** the repository (`.gitignore` excludes these extensions,
but keep them out anyway):

```powershell
# 1. Private key and signing request. Fill in the email and your name.
openssl genrsa -out ios-dist.key 2048
openssl req -new -key ios-dist.key -out ios-dist.certSigningRequest -subj "/emailAddress=you@grovitai.com/CN=GrovitAI/C=IN"
```

2. developer.apple.com → Certificates → **+** → **Apple Distribution** → upload
   `ios-dist.certSigningRequest` → download `distribution.cer`.

```powershell
# 3. Bundle certificate and key into a .p12. Choose a password; it becomes IOS_DIST_P12_PASSWORD.
openssl x509 -inform der -in distribution.cer -out distribution.pem
openssl pkcs12 -export -inkey ios-dist.key -in distribution.pem -out ios-dist.p12 -legacy

# 4. Base64 for the secret. Paste the whole output as IOS_DIST_P12_BASE64.
[Convert]::ToBase64String([IO.File]::ReadAllBytes("ios-dist.p12"))
```

Keep `ios-dist.key` and `ios-dist.p12` somewhere safe (a password manager attachment). The
certificate is valid for a year; when it expires, repeat this section and replace the two
secrets. Apple allows at most two distribution certificates at a time.

> `-legacy` matters: OpenSSL 3 otherwise produces a .p12 that macOS's `security` tool cannot
> import. If your OpenSSL is 1.1, drop the flag.

## 3. GitHub secrets

Repository → Settings → Secrets and variables → Actions → **New repository secret**, six times:

| Secret | Value |
| --- | --- |
| `APPLE_TEAM_ID` | Team ID from §1.2 |
| `APPSTORE_ISSUER_ID` | Issuer ID from §1.5 |
| `APPSTORE_KEY_ID` | Key ID from §1.5 |
| `APPSTORE_PRIVATE_KEY` | Full contents of `AuthKey_<KEY_ID>.p8`, including the BEGIN/END lines |
| `IOS_DIST_P12_BASE64` | Output of step 4 in §2 |
| `IOS_DIST_P12_PASSWORD` | Password chosen in step 3 of §2 |

## 4. Ship a build

Actions → **iOS · TestFlight** → **Run workflow** (or push a tag `ios-v1.0.0`). About 15 minutes
later the build appears in App Store Connect → TestFlight, processed a few minutes after that.
The build number is the workflow run number, so every run is accepted; the marketing version
(`1.0` today) lives in `frontend/ios/App/App.xcodeproj/project.pbxproj` as `MARKETING_VERSION`.

The IPA is also attached to the workflow run as an artifact for two weeks.

## 5. Testers

TestFlight → the app → **Internal Testing** → **+** group "Team" → add people by their Apple ID
email (they must be members of the App Store Connect team; up to 100). They receive an email,
install the **TestFlight** app, and every new build reaches them automatically. External testing
(up to 10,000 people by public link) needs a short Beta App Review the first time.

## 6. What the shell does and does not do

- Loads the bundled web app; the API URL is the public production URL from `frontend/.env`,
  baked in at build time. A backend move means a new build.
- Status bar glyphs follow the CMS theme (light on dark, dark on light).
- The Media page's file picker offers Photos and the camera; the purpose strings are in
  `Info.plist`.
- No push notifications, no offline mode, no login beyond what the web CMS has. Anyone with the
  app can reach the API, exactly as anyone with the Vercel URL can — put `ADMIN_API_KEY` in front
  of the backend before handing the app to people outside the team.

## Local development (Mac only)

```bash
cd frontend
npm run ios:sync        # vite build + copy into ios/App/App/public
npx cap open ios        # opens the project in Xcode; run on a simulator or device
```
