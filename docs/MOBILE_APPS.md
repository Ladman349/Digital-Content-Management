# Signage CMS on phones and tablets — Android APK and iOS TestFlight

The mobile app is a **controller**, not a screen. It is the CMS — assign playlists, see which
screen is online, upload media — wrapped as a native app so it sits on the home screen and
launches full-screen. Both platforms load the same Vite bundle that Vercel serves; the API URL is
baked in from `frontend/.env` at build time. Screens themselves run the player under `/android`.

| | Android controller | iOS controller | TV player |
| --- | --- | --- | --- |
| Project | `frontend/android` | `frontend/ios` | `android/` |
| Package / bundle ID | `com.grovitai.signage` | `com.grovitai.signage` | `com.digitalsignage.player` |
| Built by | `npm run android:apk` on this PC | GitHub Actions (macOS runner) | `gradlew assembleProdRelease` |
| Delivered as | APK, sideloaded | TestFlight | APK / OTA from the Updates page |

## Android — build the APK here

Prerequisites: the player's `android/local.properties` with `sdk.dir` and the four `RELEASE_*`
signing entries (the controller signs with the same release key), and a JDK — Android Studio's
bundled one works:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
cd "D:\Projects\Digital Signage\digital-signage-main\frontend"
npm run android:apk
```

(`ANDROID_HOME` is needed because this project has no `local.properties` of its own; the
player's is not shared.)

Output: `frontend/android/app/build/outputs/apk/release/app-release.apk`. Before handing it
out, bump `versionCode`/`versionName` in `frontend/android/app/build.gradle` — Android refuses
to install a build whose code is not higher than the one already on the phone.

Install on a phone: copy the APK over (Drive, WhatsApp, USB), open it, allow "install unknown
apps" for that source once. Or with a cable: `adb install -r app-release.apk`. Because the
package is `com.grovitai.signage`, it never collides with the TV player.

## iOS — TestFlight from GitHub Actions

Building for iOS needs macOS, so `.github/workflows/ios-testflight.yml` does it on GitHub's
runners: archive with manual signing (distribution certificate + App Store profile, fetched with an App Store Connect API key), export, upload.
No Mac is needed at any point. The setup below is done once.

### 1. Apple side

1. **Apple Developer Program** — enrol at <https://developer.apple.com/programs/enroll/> (US$99 a
   year, usually approved within 48 hours). Enrol as an organisation to publish under the company
   name; that needs a D-U-N-S number and takes longer.
2. **Team ID** — <https://developer.apple.com/account> → Membership details. Ten characters.
   Becomes the secret `APPLE_TEAM_ID`.
3. **App ID** — Certificates, Identifiers & Profiles → Identifiers → **+** → App IDs → App.
   Bundle ID **explicit** `com.grovitai.signage` (must match `appId` in
   `frontend/capacitor.config.ts`). No capabilities.
4. **App record** — <https://appstoreconnect.apple.com> → Apps → **+** → New App. Platform iOS,
   name "Signage CMS", English, bundle ID above, SKU `signage-cms`.
5. **App Store Connect API key** — Users and Access → Integrations → App Store Connect API →
   Team Keys → **+**. Name `github-actions`, role **App Manager**. Download the `.p8` **once**.
   Note the **Issuer ID** and the key's **Key ID**. They become `APPSTORE_ISSUER_ID`,
   `APPSTORE_KEY_ID` and `APPSTORE_PRIVATE_KEY` (the whole text of the `.p8`).

### 2. Distribution certificate — made on Windows

The private key must exist on the build machine. Xcode normally creates it; OpenSSL does the
same on Windows. Run in PowerShell from a folder **outside** the repository:

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
openssl pkcs12 -export -inkey ios-dist.key -in distribution.pem -out ios-dist.p12 -keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES -macalg sha1

# 4. Base64 for the secret. Paste the whole output as IOS_DIST_P12_BASE64.
[Convert]::ToBase64String([IO.File]::ReadAllBytes("ios-dist.p12"))
```

Keep `ios-dist.key` and `ios-dist.p12` somewhere safe. The certificate lasts a year; repeat this
section and replace the two secrets when it expires. Apple allows two distribution certificates
at a time.

> The three `-keypbe/-certpbe/-macalg` flags make OpenSSL 3 write a `.p12` that macOS can import
> without needing the `legacy` provider module, which Git's bundled OpenSSL does not ship.

5. **App Store provisioning profile.** The build signs manually, so the profile must exist:
   developer.apple.com → Certificates, Identifiers & Profiles → **Profiles** → **+** →
   **App Store Connect** (under Distribution) → App ID `com.grovitai.signage` → tick the
   distribution certificate from step 2 → name it exactly **`Signage CMS App Store`** → Generate.
   Nothing to download: the workflow fetches it with the API key. The profile is tied to the
   certificate, so regenerate it (same name) whenever the certificate is renewed.

   Automatic signing is not used because an archive under it always signs with a *development*
   identity, which needs a registered device and a development certificate the runner never has.

### 3. GitHub secrets

Repository → Settings → Secrets and variables → Actions → **New repository secret**, six times:

| Secret | Value |
| --- | --- |
| `APPLE_TEAM_ID` | Team ID from §1.2 |
| `APPSTORE_ISSUER_ID` | Issuer ID from §1.5 |
| `APPSTORE_KEY_ID` | Key ID from §1.5 |
| `APPSTORE_PRIVATE_KEY` | Full contents of `AuthKey_<KEY_ID>.p8`, BEGIN/END lines included |
| `IOS_DIST_P12_BASE64` | Output of step 4 in §2 |
| `IOS_DIST_P12_PASSWORD` | Password chosen in step 3 of §2 |

### 4. Ship a build

Actions → **iOS · TestFlight** → **Run workflow** (or push a tag `ios-v1.0.0`). About fifteen
minutes later the build is in App Store Connect → TestFlight, processed a few minutes after that.
The build number is the workflow run number, so every run is accepted; the marketing version
(`1.0`) is `MARKETING_VERSION` in `frontend/ios/App/App.xcodeproj/project.pbxproj`. The IPA is
also attached to the run as an artifact for two weeks.

### 5. Testers

TestFlight → the app → **Internal Testing** → **+** group "Team" → add people by Apple ID email
(members of the App Store Connect team, up to 100). They install the **TestFlight** app and get
every new build automatically. External testing (public link, up to 10,000) needs a short Beta
App Review the first time.

## What the shells do and do not do

- Status bar glyphs follow the CMS theme; the launch screen is the slat mark on the board ground.
- The Media page's file picker offers photos, files and the camera (iOS purpose strings are in
  `Info.plist`).
- The bundle is served from `https://localhost` (Android) and `capacitor://localhost` (iOS);
  `backend/main.py` allow-lists both origins, so the apps keep working when `APP_ENV` moves to
  `production` and the development-only localhost regex goes away.
- They sign in exactly as the web CMS does: the same sign-in screen, the same accounts. Once the
  first administrator exists (DEPLOYMENT.md, Section 6) installing the app gives a stranger nothing
  but that screen, and a client user sees only their own client's screens and content. The session
  is kept on the phone for 30 days of inactivity, so people are not asked to sign in every morning.
  Do not build the apps with `VITE_ADMIN_API_KEY` set; it would bypass sign-in for everyone.
- For TestFlight **external** testers, Apple's Beta App Review needs a working sign-in. Create a
  demo client with one screen and a demo client user, and enter those details under Test
  Information → Sign-in required.
- No push notifications and no offline mode.
- A backend move (new API host) means rebuilding both apps; the URL is compiled in.

## Local development

```bash
cd frontend
npm run android:sync && npx cap open android   # Android Studio, run on a device or emulator
npm run ios:sync && npx cap open ios           # Xcode (Mac only)
```
