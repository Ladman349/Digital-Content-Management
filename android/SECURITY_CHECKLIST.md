# Android TV Player Security Checklist

Before releasing any version of the Digital Signage Player to production, verify the following security constraints:

### 1. Build and Compilation
- [ ] **No Debuggable Flag**: Ensure `android:debuggable="false"` is active for the release build. (Configured in `build.gradle.kts` via `isDebuggable = false`).
- [ ] **No Debug Logging**: Ensure `Logger` suppresses all `.d` and verbose logs in production.
- [ ] **ProGuard/R8 Enabled**: Minification and shrinking must be enabled (`isMinifyEnabled = true`).
- [ ] **No Debug-Only Functionality**: Ensure developer backdoor menus or mock APIs are removed from the `prod` flavor.

### 2. Network Security
- [ ] **HTTPS Enforcement**: All API endpoints must use HTTPS (`BASE_URL` in `prod` flavor).
- [ ] **No Mock Endpoints**: Production builds must point only to validated production backend environments.
- [ ] **Certificate Validation**: The network layer must not bypass standard certificate validation (no blind TrustManagers).

### 3. Data Storage & Privacy
- [ ] **Backup Configuration**: Ensure `android:allowBackup="false"` is set in `AndroidManifest.xml` (or backup rules intentionally exclude sensitive preference files).
- [ ] **Token Storage**: JWT / Device Tokens must be stored securely (Datastore/EncryptedSharedPreferences).
- [ ] **Log Redaction**: Authentication tokens, maintenance PINs, secrets, and API keys must be explicitly redacted from all logging systems.

### 4. Application State & Kiosk
- [ ] **Hashed PINs**: The Maintenance PIN must NEVER be stored or transmitted in plain text. Only hashes (SHA-256 or stronger) are permitted.
- [ ] **Secure Recovery**: The boot and crash recovery pipelines must automatically lock the device into Kiosk Mode upon restart.
- [ ] **Device Owner Restriction**: The app must successfully claim Device Owner privileges to prevent unauthorized exit from LockTask mode in production.
