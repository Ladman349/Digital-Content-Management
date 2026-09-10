# Rotating the release signing key

The release keystore (`android/app/release.jks`) and its passwords were committed to this repository
and are present in the history of every clone taken before the purge. **Treat the old key as
compromised.** Anyone holding it can sign an APK that Android will accept as an update to the
installed player, because Android trusts the signature, not the source.

Removing the file from history does not undo that. Rotation is the fix; the purge only stops the
next person finding it.

## Read this before you start

Rotation is not reversible from the fleet's point of view. Android refuses to install an update
signed with a different key than the installed app, and the OTA system cannot work around it —
a re-signed APK will be rejected by every screen already running the old build.

**Every deployed screen must be visited once**: uninstall the player, install the new APK, re-pair.
There is no remote path. Do it while the fleet is small; the cost is linear in screens and only
grows.

Losing the new keystore is worse than the leak: without it you can never ship another update to
those screens, only a fresh install. Back it up before you ship anything signed with it.

## 1. Generate the new keystore

Run this yourself so the password is only ever yours — do not paste it into a chat, a ticket, or a
CI log. From the repository root:

```
"C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkeypair -v ^
  -keystore android\app\release-2026.jks ^
  -alias signage-release-2026 ^
  -keyalg RSA -keysize 4096 -validity 10950 ^
  -storetype PKCS12
```

`keytool` prompts for a password and for the certificate's distinguished name. Notes on the flags:

- **A new filename and alias.** Reusing `release.jks` invites confusion with the compromised file
  and makes it harder to tell, later, which key a given APK was signed with.
- **4096-bit RSA, 30 years.** Play's guidance is that the key must outlive the app; an expired
  signing key strands the fleet the same way a lost one does.
- **PKCS12** is the standard container. `keytool` will otherwise warn about the proprietary JKS
  format on every invocation.

## 2. Point the build at it

`android/local.properties` is git-ignored and must stay that way. Update these four keys:

```
RELEASE_STORE_FILE=release-2026.jks
RELEASE_STORE_PASSWORD=<the store password you just set>
RELEASE_KEY_ALIAS=signage-release-2026
RELEASE_KEY_PASSWORD=<the key password you just set>
```

`RELEASE_STORE_FILE` is resolved relative to the `android/app` module, so the bare filename is
correct. The build reads these properties or the matching environment variables, and fails during
packaging if any is missing — see the `signingConfigs` block in `android/app/build.gradle.kts`.

## 3. Back it up before you ship

The keystore file and its passwords need to live somewhere that survives this machine: a password
manager entry with the file attached, or an encrypted backup held by more than one person. A key
that exists only in `android/app/` on one laptop is one disk failure away from a fleet you can
never update again.

## 4. Verify before rolling out

Build a release APK and confirm it carries the new certificate:

```
cd android
.\gradlew.bat assembleProdRelease
```

Read the certificate with **apksigner**, not `keytool`. `keytool -printcert -jarfile` only
understands v1 JAR signatures and answers "Not a signed jar file" for a v2/v3-signed APK, which
looks alarming and means nothing at all. apksigner needs `JAVA_HOME` pointed at the Android Studio
JBR:

```
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
& "$env:LOCALAPPDATA\Android\Sdk\build-tools\36.1.0\apksigner.bat" verify --verbose --print-certs android\app\build\outputs\apk\prod\release\app-prod-release.apk
```

The SHA-256 digest must differ from the old key's. If it matches, the build is still picking up the
old keystore and nothing has actually rotated.

For the record, the rotation carried out on 11 September 2026:

| | Certificate |
| --- | --- |
| Old, leaked | `CN=Test, OU=Test, O=Test, C=US` &middot; `ac3fb321...febc2dc2` |
| New | `CN=Digital Signage Player, L=Kozhikode, C=IN` &middot; `2936ad18...1055c017` |

The old certificate was a placeholder someone generated to get a build out, which is worth knowing:
nothing of value was lost in replacing it.

## 5. Destroy the old key — but not yet

The old keystore keeps exactly one legitimate use until the rollout finishes: signing a final
build that the *currently installed* screens will still accept. If you ever want to push a last
over-the-air update to the old fleet — a notice, a version bump, anything — it has to be signed
with the old key, because that is the signature those screens trust.

So keep `android/app/release.jks` until at least one screen is confirmed running the new key, then
delete it from disk and from every backup that holds it. After that it only preserves someone
else's ability to sign as the compromised identity.

## 5a. Signature schemes

`build.gradle.kts` pins the schemes explicitly:

- **v1 off.** JAR signing only matters below Android 7.0 and `minSdk` is 24, so it buys nothing and
  slows installation.
- **v2 on.** This is what actually verifies the APK on every device this project supports.
- **v3 on.** This carries the certificate's rotation lineage. The original build shipped v2 only,
  which is part of why this rotation costs a physical visit to every screen: without v3 there is no
  signed proof that the new key supersedes the old one. With it enabled now, a future rotation can
  be delivered over the air instead.

Confirm all three with `apksigner verify --verbose` after any change to the signing config.

## 6. Roll out

1. Upload the new APK on the CMS **Updates** page, but do not activate it yet — screens on the old
   key cannot install it, and a failed install loop is noise you do not want.
2. Visit each screen: uninstall the player, install the new APK manually (`adb install`, or a USB
   stick), let it re-register.
3. Once every screen reports the new version on the **Screens** board, activate the release so
   future updates flow over the air again.

Screens still on the old key will keep running and keep reporting; they simply will not take
updates. The **Versions in the fleet** panel on the Updates page is how you tell which are which.
