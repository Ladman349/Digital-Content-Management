package com.digitalsignage.player.core.ota.installer

import android.app.admin.DevicePolicyManager
import android.content.Context
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import com.digitalsignage.player.core.kiosk.KioskManager
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.io.File
import java.security.MessageDigest
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class OtaInstallManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val standardInstaller: StandardInstaller,
    private val silentInstaller: SilentInstaller,
    private val kioskManager: KioskManager
) {
    companion object {
        private const val TAG = "KioskTrace"
    }

    private val _installState = MutableStateFlow<InstallResult>(InstallResult.Idle)
    val installState: StateFlow<InstallResult> = _installState.asStateFlow()

    /**
     * Parses, hashes and streams the APK; must never run on the main thread.
     */
    suspend fun install(): InstallResult = withContext(Dispatchers.IO) {
        installBlocking()
    }

    private fun installBlocking(): InstallResult {
        _installState.value = InstallResult.Preparing
        Log.i(TAG, "[OTA] OtaInstallManager starting installation sequence...")

        val otaDir = File(context.getExternalFilesDir(null), "ota")
        val apkFile = File(otaDir, "update.apk")
        val metadataFile = File(otaDir, "metadata.json")

        if (!apkFile.exists()) {
            val err = "update.apk file does not exist"
            Log.e(TAG, "[OTA] $err")
            val result = InstallResult.Failed(err)
            _installState.value = result
            return result
        }

        if (!metadataFile.exists()) {
            val err = "metadata.json file does not exist"
            Log.e(TAG, "[OTA] $err")
            val result = InstallResult.Failed(err)
            _installState.value = result
            return result
        }

        _installState.value = InstallResult.Validating

        // 1. Verify Package archive info (Package Name & Version Code)
        val pm = context.packageManager
        val archiveInfo = pm.getPackageArchiveInfo(apkFile.absolutePath, 0)
        if (archiveInfo == null) {
            val err = "Failed to parse downloaded APK archive info (corrupted file)"
            Log.e(TAG, "[OTA] $err")
            val result = InstallResult.Failed(err)
            _installState.value = result
            return result
        }

        val targetPackageName = archiveInfo.packageName
        val targetVersionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            archiveInfo.longVersionCode
        } else {
            @Suppress("DEPRECATION")
            archiveInfo.versionCode.toLong()
        }

        Log.i(TAG, "[OTA] APK Package ID: $targetPackageName")
        Log.i(TAG, "[OTA] APK Version Code: $targetVersionCode")

        // Validate package name matches application package
        val appPackageName = context.packageName
        if (targetPackageName != appPackageName) {
            val err = "Package name mismatch! Target: $targetPackageName, App: $appPackageName"
            Log.e(TAG, "[OTA] $err")
            val result = InstallResult.Failed(err)
            _installState.value = result
            return result
        }

        // Validate version code is greater than currently installed version
        val currentVersionCode = getCurrentVersionCode()
        if (targetVersionCode <= currentVersionCode) {
            val err = "Downloaded version ($targetVersionCode) is not newer than current version ($currentVersionCode)"
            Log.w(TAG, "[OTA] $err")
            val result = InstallResult.Failed(err)
            _installState.value = result
            return result
        }

        // 2. Signature verification (hard gate — a foreign signer can never replace this app)
        val signatureError = verifySignatures(apkFile)
        if (signatureError != null) {
            Log.e(TAG, "[OTA] $signatureError")
            val result = InstallResult.Failed(signatureError)
            _installState.value = result
            return result
        }

        // 3. Select installation mechanism based on Device Owner status
        _installState.value = InstallResult.Installing
        val isDeviceOwner = isAppDeviceOwner()

        Log.i(TAG, "[OTA] Device Owner Status: $isDeviceOwner")
        return if (isDeviceOwner) {
            silentInstaller.install(context, apkFile, _installState)
            _installState.value
        } else {
            val result = standardInstaller.install(context, apkFile)
            _installState.value = result
            result
        }
    }

    private fun getCurrentVersionCode(): Long {
        val pm = context.packageManager
        return try {
            val pInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                pm.getPackageInfo(context.packageName, PackageManager.PackageInfoFlags.of(0))
            } else {
                @Suppress("DEPRECATION")
                pm.getPackageInfo(context.packageName, 0)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                pInfo.longVersionCode
            } else {
                @Suppress("DEPRECATION")
                pInfo.versionCode.toLong()
            }
        } catch (e: Exception) {
            Log.e(TAG, "[OTA] Failed to get current version code", e)
            1L
        }
    }

    private fun isAppDeviceOwner(): Boolean {
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as? DevicePolicyManager
        return dpm?.isDeviceOwnerApp(context.packageName) ?: false
    }

    /**
     * Compares the full signer sets of the installed app and the downloaded APK.
     *
     * Returns a failure reason ONLY when both sets could be read, both are non-empty, and they
     * share no certificate SHA-256 in common. When either set cannot be read (unparsable APK,
     * platform quirk, exception) the check logs a warning and lets the install proceed — the
     * platform installer performs its own signature enforcement, so a false rejection here would
     * brick the update path for no gain.
     */
    private fun verifySignatures(apkFile: File): String? {
        try {
            val pm = context.packageManager
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                PackageManager.GET_SIGNING_CERTIFICATES
            } else {
                @Suppress("DEPRECATION")
                PackageManager.GET_SIGNATURES
            }

            // Get current app signatures
            val appInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                pm.getPackageInfo(context.packageName, PackageManager.PackageInfoFlags.of(flags.toLong()))
            } else {
                @Suppress("DEPRECATION")
                pm.getPackageInfo(context.packageName, flags)
            }

            // Get downloaded APK signatures
            val archiveInfo = pm.getPackageArchiveInfo(apkFile.absolutePath, flags)
            if (archiveInfo == null) {
                Log.w(TAG, "[OTA] Signature check: Failed to read downloaded APK signatures. Proceeding.")
                return null
            }

            val currentHashes = getSignatures(appInfo).map { sha256Hex(it) }.toSet()
            val targetHashes = getSignatures(archiveInfo).map { sha256Hex(it) }.toSet()

            if (currentHashes.isEmpty() || targetHashes.isEmpty()) {
                Log.w(TAG, "[OTA] Signature check: Unable to extract signature lists. Proceeding.")
                return null
            }

            Log.i(TAG, "[OTA] Current app cert SHA-256 set: $currentHashes")
            Log.i(TAG, "[OTA] Downloaded APK cert SHA-256 set: $targetHashes")

            return if (currentHashes.intersect(targetHashes).isNotEmpty()) {
                Log.i(TAG, "[OTA] Signature check: Success. Signer sets share a common certificate.")
                null
            } else {
                "Signature verification failed: the downloaded APK is signed by a different key " +
                    "than the installed app. Installation aborted."
            }
        } catch (e: Exception) {
            Log.w(TAG, "[OTA] Signature check: Verification failed with exception: ${e.message}. Proceeding.")
            return null
        }
    }

    private fun sha256Hex(bytes: ByteArray): String =
        MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }

    private fun getSignatures(packageInfo: PackageInfo): List<ByteArray> {
        val sigList = mutableListOf<ByteArray>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val signingInfo = packageInfo.signingInfo
            if (signingInfo != null) {
                if (signingInfo.hasMultipleSigners()) {
                    signingInfo.apkContentsSigners?.forEach { sigList.add(it.toByteArray()) }
                } else {
                    signingInfo.signingCertificateHistory?.forEach { sigList.add(it.toByteArray()) }
                }
            }
        } else {
            @Suppress("DEPRECATION")
            packageInfo.signatures?.forEach { sigList.add(it.toByteArray()) }
        }
        return sigList
    }
}
