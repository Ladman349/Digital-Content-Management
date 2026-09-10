package com.digitalsignage.player.core.ota.manager

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import com.digitalsignage.player.core.network.NetworkMonitor
import com.digitalsignage.player.core.ota.downloader.ApkDownloadManager
import com.digitalsignage.player.core.ota.downloader.DownloadState
import com.digitalsignage.player.core.ota.installer.InstallResult
import com.digitalsignage.player.core.ota.installer.OtaInstallManager
import com.digitalsignage.player.core.ota.model.OtaCheckResult
import com.digitalsignage.player.core.ota.model.OtaState
import com.digitalsignage.player.di.ApplicationScope
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.util.concurrent.atomic.AtomicBoolean
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Owns the whole OTA pipeline: check -> download (with retry) -> verify -> install -> cleanup.
 *
 * Lives in the singleton component and runs on the application scope, so it survives Activity
 * recreation and can hold a long-lived periodic schedule. The UI only observes [otaState].
 */
@Singleton
class OtaCoordinator @Inject constructor(
    @ApplicationContext private val context: Context,
    @ApplicationScope private val appScope: CoroutineScope,
    private val otaUpdateManager: OtaUpdateManager,
    private val apkDownloadManager: ApkDownloadManager,
    private val otaInstallManager: OtaInstallManager,
    private val networkMonitor: NetworkMonitor
) {
    companion object {
        private const val TAG = "KioskTrace"

        /** Delay before the first check so startup (registration, first sync) is not competing. */
        private const val INITIAL_DELAY_MS = 30_000L

        /** Repeating check interval: every 6 hours for the lifetime of the process. */
        const val CHECK_INTERVAL_MS = 6L * 60L * 60L * 1000L

        /**
         * Non-mandatory updates are installed as soon as they are ready too: this is an unattended
         * kiosk with no one to approve anything. Flip this single constant to defer them.
         */
        private const val INSTALL_NON_MANDATORY_IMMEDIATELY = true
    }

    private val _otaState = MutableStateFlow<OtaState>(OtaState.Idle)
    val otaState: StateFlow<OtaState> = _otaState.asStateFlow()

    /** Guards against two pipeline runs (check or download) overlapping. */
    private val pipelineMutex = Mutex()

    private val started = AtomicBoolean(false)

    /**
     * Starts the periodic pipeline. Idempotent: repeated calls (e.g. Application plus a defensive
     * Activity call) are ignored.
     */
    fun start() {
        if (!started.compareAndSet(false, true)) {
            Log.d(TAG, "[OTA] Coordinator already started; ignoring duplicate start()")
            return
        }
        Log.i(TAG, "[OTA] Coordinator starting. Interval=${CHECK_INTERVAL_MS / 3_600_000}h")

        observeInstallState()
        observeDownloadProgress()
        cleanUpIfAlreadyInstalled()

        appScope.launch {
            delay(INITIAL_DELAY_MS)
            while (true) {
                runPipelineOnce()
                delay(CHECK_INTERVAL_MS)
            }
        }
    }

    /** Manual entry point used by the DEBUG-only "Trigger Install" button. */
    fun triggerInstallNow() {
        appScope.launch {
            Log.i(TAG, "[OTA] Manual install requested via debug trigger")
            installStagedUpdate(mandatory = false, manual = true)
        }
    }

    /** Manual entry point: run the full pipeline immediately (used by debug tooling/tests). */
    fun checkNow() {
        appScope.launch { runPipelineOnce() }
    }

    private suspend fun runPipelineOnce() {
        if (pipelineMutex.isLocked) {
            Log.i(TAG, "[OTA] Pipeline already running; skipping this tick")
            return
        }
        pipelineMutex.withLock {
            try {
                pipeline()
            } catch (e: Exception) {
                Log.e(TAG, "[OTA] Pipeline crashed: ${e.message}", e)
                _otaState.value = OtaState.Failed(e.message ?: "Unknown OTA error")
            }
        }
    }

    private suspend fun pipeline() {
        // 1. Offline? Nothing here can succeed, and every stage would just log noise.
        if (!networkMonitor.isOnline.first()) {
            Log.i(TAG, "[OTA] Device is offline. Skipping update pipeline.")
            _otaState.value = OtaState.Offline
            return
        }

        // 2. Check.
        _otaState.value = OtaState.Checking
        when (val result = otaUpdateManager.checkForUpdates()) {
            is OtaCheckResult.NoUpdate -> {
                Log.i(TAG, "[OTA] No update available. App is up to date.")
                _otaState.value = OtaState.UpToDate
                // A staged APK that the server no longer advertises is dead weight.
                cleanUpIfAlreadyInstalled()
            }

            is OtaCheckResult.Failure -> {
                Log.w(TAG, "[OTA] Check failed: ${result.message}")
                _otaState.value = OtaState.Failed(result.message)
            }

            is OtaCheckResult.UpdateAvailable -> {
                Log.i(
                    TAG,
                    """
                    ==================================================
                    [OTA] UPDATE AVAILABLE
                    Current Version : ${result.currentVersionCode}
                    Latest Version  : ${result.latestVersionCode} (name: ${result.versionName})
                    Mandatory       : ${result.mandatory}
                    APK URL         : ${result.apkUrl}
                    Checksum        : ${result.checksum}
                    File Size       : ${result.fileSize} bytes
                    Release Notes   : ${result.releaseNotes ?: "None"}
                    ==================================================
                    """.trimIndent()
                )
                _otaState.value = OtaState.UpdateFound(
                    versionCode = result.latestVersionCode,
                    versionName = result.versionName,
                    mandatory = result.mandatory
                )

                // 3. Download (retries and checksum verification live in ApkDownloadManager).
                val downloaded = apkDownloadManager.download(result)

                if (!downloaded) {
                    val reason = (apkDownloadManager.downloadState.value as? DownloadState.Failed)
                        ?.reason ?: "Download failed"
                    Log.e(TAG, "[OTA] Download did not complete: $reason")
                    _otaState.value = OtaState.Failed(reason)
                    return
                }

                // 4. Install.
                _otaState.value = OtaState.ReadyForInstall
                installStagedUpdate(mandatory = result.mandatory, manual = false)
            }
        }
    }

    private suspend fun installStagedUpdate(mandatory: Boolean, manual: Boolean) {
        if (mandatory) {
            Log.i(TAG, "[OTA] Update is MANDATORY - installing immediately.")
        } else if (INSTALL_NON_MANDATORY_IMMEDIATELY) {
            Log.i(
                TAG,
                "[OTA] Update is optional, but this is an unattended kiosk - installing immediately."
            )
        } else {
            Log.i(TAG, "[OTA] Update is optional and deferred installs are enabled - not installing.")
            return
        }

        _otaState.value = OtaState.Installing
        val result = otaInstallManager.install()
        Log.i(TAG, "[OTA] Install invoked (manual=$manual). Immediate result: $result")

        // Silent installs report their real outcome asynchronously through installState, which
        // observeInstallState() picks up (including the post-success cleanup).
        if (result is InstallResult.Failed) {
            _otaState.value = OtaState.Failed(result.reason)
        }
    }

    private fun observeInstallState() {
        appScope.launch {
            otaInstallManager.installState.collect { state ->
                when (state) {
                    is InstallResult.Installed -> {
                        Log.i(TAG, "[OTA] Install reported success - cleaning up staged files.")
                        _otaState.value = OtaState.Installed
                        apkDownloadManager.clearStagedUpdate()
                    }
                    is InstallResult.Failed -> {
                        Log.e(TAG, "[OTA] Install failed: ${state.reason}")
                        _otaState.value = OtaState.Failed(state.reason)
                    }
                    is InstallResult.Installing,
                    is InstallResult.InstallCommitted -> {
                        _otaState.value = OtaState.Installing
                    }
                    else -> {
                        // Idle/Preparing/Validating/etc. carry no extra information for the UI.
                    }
                }
            }
        }
    }

    /**
     * If the process is already running a version at least as new as the staged APK, the update
     * landed (typically the app was replaced and restarted) - delete the staged files so the
     * checksum short-circuit in the downloader cannot keep re-announcing them as "ready".
     */
    private fun cleanUpIfAlreadyInstalled() {
        val staged = apkDownloadManager.stagedVersionCode() ?: return
        val current = installedVersionCode()
        if (current >= staged.toLong()) {
            Log.i(
                TAG,
                "[OTA] Running version $current already covers staged version $staged - cleaning up."
            )
            apkDownloadManager.clearStagedUpdate()
        }
    }

    /**
     * Mirrors APK download progress into [otaState] while a transfer is in flight. Terminal states
     * are left to the pipeline itself so this collector can never clobber an install result.
     */
    private fun observeDownloadProgress() {
        appScope.launch {
            apkDownloadManager.downloadState.collect { state ->
                when (state) {
                    is DownloadState.Downloading -> _otaState.value = OtaState.Downloading(-1)
                    is DownloadState.Progress -> _otaState.value = OtaState.Downloading(state.percent)
                    is DownloadState.Verifying -> _otaState.value = OtaState.Verifying
                    else -> Unit
                }
            }
        }
    }

    private fun installedVersionCode(): Long {
        return try {
            val pm = context.packageManager
            val info = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                pm.getPackageInfo(context.packageName, PackageManager.PackageInfoFlags.of(0))
            } else {
                @Suppress("DEPRECATION")
                pm.getPackageInfo(context.packageName, 0)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                info.longVersionCode
            } else {
                @Suppress("DEPRECATION")
                info.versionCode.toLong()
            }
        } catch (e: Exception) {
            Log.e(TAG, "[OTA] Failed to read installed version code", e)
            0L
        }
    }
}
