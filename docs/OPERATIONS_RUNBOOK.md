# Digital Signage Player - Operations Runbook

This runbook describes operational procedures for field technicians, installers, and support engineers managing the Android TV Signage Player in production.

## 1. Initial Provisioning & Installation
1. Install the APK via ADB (`adb install app-prod-release.apk`) or via MDM deployment.
2. If using ADB, set the application as Device Owner before launching it:
   ```bash
   adb shell dpm set-device-owner com.digitalsignage.player/.core.kiosk.SignageDeviceAdminReceiver
   ```
3. Launch the application. 
4. The device will generate an installation token and display it on the screen. Enter this token in the management dashboard to register the display.

## 2. Maintenance Mode Usage
Maintenance mode temporarily suspends Kiosk Mode to allow field technicians to access the underlying Android TV settings (e.g., to configure Wi-Fi, change display resolution, etc.).

**To enter Maintenance Mode:**
1. Using the remote, press **BACK 5 times** rapidly.
2. An overlay dialog will prompt for the Maintenance PIN.
3. Enter the site-specific Maintenance PIN configured on the backend.
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

## 8. Common Troubleshooting Procedures
* **Screen is Black but Device is On:** 
  The device may be downloading a completely new playlist. Check the dashboard for the "Downloading" status.
* **Stuck on Splash Screen:** 
  Ensure the device is connected to the internet. If it remains stuck, power cycle to trigger `StartupValidator` to fix potential database corruptions.
* **App Not Pinning/Locking:** 
  Ensure the app was correctly configured as the Device Owner via ADB or MDM. If the app is not Device Owner, it falls back to standard "Screen Pinning", which users may escape by holding BACK+HOME.
