# Digital Signage Player - Operations Runbook

This runbook describes operational procedures for field technicians, installers, and support engineers managing the Android TV Signage Player in production.

## 1. Initial Provisioning & Installation
1. Install the APK via ADB (`adb install app-prod-release.apk`) or via MDM deployment. The build
   installs on TVs, signage boxes, tablets and phones alike; the status screen resizes itself to
   the device, so a tablet in a shop window is provisioned exactly like a TV.
2. If using ADB, set the application as Device Owner before launching it:
   ```bash
   adb shell dpm set-device-owner com.digitalsignage.player/.core.kiosk.SignageDeviceAdminReceiver
   ```
3. Launch the application.
4. The player registers itself automatically over the network — there is no code or token to type in.
   The status screen shows the assigned **Device ID** (for example `TV-073D5AAB`), the device name,
   IP address and app version.
5. In the CMS, open **Devices**, find the screen by that Device ID, and set its name and location.
   Then assign a playlist directly or create a schedule for it.

> If the screen never leaves "Registering with server" or "No network connection", the device cannot
> reach the API. Enter Maintenance Mode and check connectivity (see section 2).

## 2. Maintenance Mode Usage
Maintenance mode temporarily suspends Kiosk Mode to allow field technicians to access the underlying Android TV settings (e.g., to configure Wi-Fi, change display resolution, etc.).

**To enter Maintenance Mode:**
1. Using the remote, **press and hold the BACK button** until the dialog appears.
2. An overlay dialog will prompt for the Maintenance PIN.
3. Enter the Maintenance PIN provisioned for the device.
4. The application will unlock and minimize, granting access to the system UI.
5. Maintenance mode will automatically end after 60 seconds of inactivity, instantly returning the device to Kiosk Mode.

## 3. Device Offline Recovery
If a device appears "Offline" on the dashboard:
1. **Network Check:** Enter Maintenance Mode and verify Wi-Fi / Ethernet connectivity.
2. **Reboot:** Power cycle the device. The `BootReceiver` will automatically resume operation.
3. **Network Restored:** Once connectivity is restored, the `PlayerOrchestrator` will automatically resume playlist synchronization and heartbeat dispatching without manual intervention.

## 4. Playlist Synchronization Failures
If the screen does not update to the latest playlist:
1. Check the network connection (see above).
2. The player will continuously retry fetching the latest playlist utilizing an exponential backoff strategy if the initial sync fails.
3. If failures persist, verify the backend API endpoints are reachable from the network segment where the device is installed.

## 5. Storage Recovery
If the device runs out of local storage (e.g., extremely large video files):
1. The `DownloadManager` will log a space exhaustion error and pause downloading.
2. The application's `StartupValidator` clears orphaned or corrupt temporary files during every boot.
3. A device reboot will force a cleanup of corrupted temporary downloads. 
4. If the active playlist exceeds the physical hardware capacity, the playlist must be shortened via the backend dashboard.

## 6. Device Replacement & Reprovisioning
If hardware must be swapped:
1. **Deregister Old Device:** Mark the old device as "Archived" or "Decommissioned" in the dashboard.
2. **Provision New Device:** Follow the Initial Provisioning steps for the new Android TV box.
3. **Assign Playlist:** Re-assign the desired playlist to the newly provisioned device on the dashboard.
*Note: Do not clone storage chips between devices, as the Android Keystore and Installation IDs will mismatch.*

## 7. Crash Recovery
The player employs a multi-tiered crash recovery strategy:
1. An internal `CrashRecoveryManager` intercepts uncaught exceptions.
2. Crash metadata is flushed synchronously to local storage.
3. The application will attempt to schedule a restart using `AlarmManager`.
4. If the device reboots, `BootReceiver` captures the boot event and initiates a clean startup.
5. In all cases, the application returns directly to Kiosk Mode without manual intervention.

## 8. Player Updates (OTA)

Players update themselves. They ask the backend for the active release about 30 seconds after
starting and every 6 hours after that, download it, verify its SHA-256 and signing certificate, then
install it. A device-owner install is silent and the app restarts on the new version.

**A screen is not updating:**
1. Confirm a release is marked **Active** in **CMS → App updates**. Only the active release is
   offered.
2. Check the release's version code is **higher** than the version the screen reports in
   **Versions in the fleet**. Android refuses to install an equal or lower version code.
3. Confirm the screen is online. The update check is skipped entirely while offline.
4. Wait out the interval. A screen that has just been checked can be up to 6 hours from its next
   attempt; power-cycling it forces a check ~30 seconds after boot.
5. Look for `[OTA]` lines under the `KioskTrace` tag in Logcat. The pipeline logs each stage:
   check, download progress, checksum verification, signature check, install.

**"Not durable" badge on a release:** the APK is on the backend's local disk and will disappear on
the next redeploy. Configure object storage (Deployment Guide, Section 5) and re-upload the release.

**Download keeps failing:** the player retries three times with backoff. Persistent failure is
usually the APK missing from storage. Fetch the release's download URL from the CMS; a 404 with
"never copied to object storage" means the file is gone and the release must be re-uploaded.

**Install refused after a successful download:** almost always a signing mismatch. The OTA APK must
be signed with the same key as the build already on the device. Check the logged certificate hashes;
a key rotation requires a manual re-install on site.

**Stopping a bad rollout:** deactivate the release in the CMS. Screens stop being offered it
immediately. Screens that already installed it stay on that version, so recovering them requires a
**new** release with a higher version code containing the older code.

---

## 9. Common Troubleshooting Procedures
* **Screen is Black but Device is On:** 
  The device may be downloading a completely new playlist. Check the dashboard for the "Downloading" status.
* **Stuck on Splash Screen:** 
  Ensure the device is connected to the internet. If it remains stuck, power cycle to trigger `StartupValidator` to fix potential database corruptions.
* **App Not Pinning/Locking:** 
  Ensure the app was correctly configured as the Device Owner via ADB or MDM. If the app is not Device Owner, it falls back to standard "Screen Pinning", which users may escape by holding BACK+HOME.
