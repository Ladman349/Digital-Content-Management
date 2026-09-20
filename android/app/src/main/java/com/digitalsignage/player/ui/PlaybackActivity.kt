package com.digitalsignage.player.ui

import android.content.Context
import android.os.Bundle
import android.os.Environment
import android.view.KeyEvent
import android.view.View
import java.io.File
import java.io.FileOutputStream
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.media3.ui.PlayerView
import com.digitalsignage.player.R
import com.digitalsignage.player.core.event.PlayerEvent
import com.digitalsignage.player.core.event.PlayerEventBus
import com.digitalsignage.player.core.identity.DeviceIdentityManager
import com.digitalsignage.player.core.network.NetworkMonitor
import com.digitalsignage.player.databinding.ActivityPlaybackBinding
import com.digitalsignage.player.domain.orchestrator.PlayerOrchestrator
import com.digitalsignage.player.domain.playback.PlaybackController
import com.digitalsignage.player.player.playback.PlaybackControllerImpl
import com.digitalsignage.player.data.local.datastore.RuntimeConfigStoreImpl
import com.digitalsignage.player.data.remote.dto.DeviceOrientation
import com.digitalsignage.player.presentation.PlaybackViewModel
import com.digitalsignage.player.presentation.PresentationState
import android.widget.FrameLayout
import android.view.Gravity
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.Dispatchers
import coil.load
import coil.dispose
import javax.inject.Inject
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

@AndroidEntryPoint
class PlaybackActivity : AppCompatActivity() {

    private lateinit var binding: ActivityPlaybackBinding

    @Inject lateinit var playerOrchestrator: PlayerOrchestrator
    @Inject lateinit var playbackController: PlaybackController
    @Inject lateinit var eventBus: PlayerEventBus
    @Inject lateinit var runtimeConfigStore: RuntimeConfigStoreImpl
    @Inject lateinit var otaCoordinator: com.digitalsignage.player.core.ota.manager.OtaCoordinator
    @Inject lateinit var networkMonitor: NetworkMonitor
    @Inject lateinit var deviceIdentityManager: DeviceIdentityManager
    @Inject lateinit var screenshotReporter: com.digitalsignage.player.core.health.ScreenshotReporter

    private val viewModel: PlaybackViewModel by viewModels()

    private var currentOrientation: String = DeviceOrientation.LANDSCAPE

    private val screenEventsReceiver = object : android.content.BroadcastReceiver() {
        override fun onReceive(context: Context, intent: android.content.Intent) {
            android.util.Log.i("KioskTrace", "Screen wake event detected: ${intent.action}")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        com.digitalsignage.player.core.performance.PerformanceMonitor.logDeviceSignatureOnce(this)
        binding = ActivityPlaybackBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Keep display awake
        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        binding.root.keepScreenOn = true
        android.util.Log.i("KioskTrace", "KEEP_SCREEN_ON enabled")

        // Keep above lockscreen
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }

        // Register screen event receiver
        val filter = android.content.IntentFilter().apply {
            addAction(android.content.Intent.ACTION_SCREEN_ON)
            addAction(android.content.Intent.ACTION_USER_PRESENT)
        }
        registerReceiver(screenEventsReceiver, filter)

        // Hide system UI immediately
        hideSystemUI()

        // Cold start shows the "Starting up" status screen, never "No content".
        renderState(PresentationState.Booting)
        bindIdentityBar()

        binding.btnCopyDiagnostics.setOnClickListener {
            copyDiagnosticsToClipboard()
        }
        binding.btnSaveDiagnostics.setOnClickListener {
            saveDiagnosticsToDownloads()
        }
        binding.btnTriggerInstall.setOnClickListener {
            android.util.Log.i("KioskTrace", "[OTA] Trigger Install clicked. Initiating manual installation pre-checks...")
            otaCoordinator.triggerInstallNow()
        }

        // The OTA pipeline itself lives in OtaCoordinator (application scope). The Activity is a
        // pure observer: it logs progress and never drives check/download/install.
        lifecycleScope.launch {
            otaCoordinator.otaState.collect { state ->
                when (state) {
                    is com.digitalsignage.player.core.ota.model.OtaState.Idle -> {
                        android.util.Log.i("KioskTrace", "[OTA] State: Idle")
                    }
                    is com.digitalsignage.player.core.ota.model.OtaState.Checking -> {
                        android.util.Log.i("KioskTrace", "[OTA] State: Checking for updates")
                    }
                    is com.digitalsignage.player.core.ota.model.OtaState.UpToDate -> {
                        android.util.Log.i("KioskTrace", "[OTA] State: App is up to date")
                    }
                    is com.digitalsignage.player.core.ota.model.OtaState.UpdateFound -> {
                        android.util.Log.i(
                            "KioskTrace",
                            "[OTA] State: Update found ${state.versionName} (${state.versionCode}), mandatory=${state.mandatory}"
                        )
                    }
                    is com.digitalsignage.player.core.ota.model.OtaState.Downloading -> {
                        android.util.Log.i("KioskTrace", "[OTA] State: Downloading ${state.percent}%")
                    }
                    is com.digitalsignage.player.core.ota.model.OtaState.Verifying -> {
                        android.util.Log.i("KioskTrace", "[OTA] State: Verifying checksum")
                    }
                    is com.digitalsignage.player.core.ota.model.OtaState.ReadyForInstall -> {
                        android.util.Log.i("KioskTrace", "[OTA] State: Ready for installation")
                    }
                    is com.digitalsignage.player.core.ota.model.OtaState.Installing -> {
                        android.util.Log.i("KioskTrace", "[OTA] State: Installing")
                    }
                    is com.digitalsignage.player.core.ota.model.OtaState.Installed -> {
                        android.util.Log.i("KioskTrace", "[OTA] State: Installed")
                    }
                    is com.digitalsignage.player.core.ota.model.OtaState.Offline -> {
                        android.util.Log.i("KioskTrace", "[OTA] State: Offline, pipeline skipped")
                    }
                    is com.digitalsignage.player.core.ota.model.OtaState.Failed -> {
                        android.util.Log.e("KioskTrace", "[OTA] State: Failed (reason: ${state.reason})")
                    }
                }
            }
        }

        val exoController = playbackController as? PlaybackControllerImpl
        if (exoController != null) {
            val playerView = binding.playerView
            playerView.player = exoController.exoPlayer
        }

        android.util.Log.i("InvestigateReg", "1. PlaybackActivity.onCreate() reached")
        android.util.Log.i("StartupTrace", "Trace: PlaybackActivity calling playerOrchestrator.initialize()")
        playerOrchestrator.initialize()
        
        lifecycleScope.launch {
            viewModel.state.collect { state ->
                renderState(state)
            }
        }
        
        lifecycleScope.launch {
            eventBus.events.collectLatest { event ->
                when (event) {
                    is PlayerEvent.MaintenanceRequested -> showMaintenanceDialog()
                    is PlayerEvent.EngineInitialized -> {
                        val exoController = playbackController as? PlaybackControllerImpl
                        if (exoController != null) {
                            binding.playerView.player = exoController.exoPlayer
                            android.util.Log.i("PlayerViewTrace", "Assigned exoPlayer. Success: ${binding.playerView.player != null}")
                            android.util.Log.i("PlayerViewTrace", "playerView.player == null: ${binding.playerView.player == null}")
                            android.util.Log.i("PlayerViewTrace", "playerView.visibility: ${binding.playerView.visibility}")
                            android.util.Log.i("PlayerViewTrace", "playerView.alpha: ${binding.playerView.alpha}")
                            android.util.Log.i("PlayerViewTrace", "playerView.width: ${binding.playerView.width}")
                            android.util.Log.i("PlayerViewTrace", "playerView.height: ${binding.playerView.height}")
                            android.util.Log.i("PlayerViewTrace", "playerView.isAttachedToWindow: ${binding.playerView.isAttachedToWindow}")
                        }
                    }
                    is PlayerEvent.PlaybackStarted -> {
                        binding.loadingIndicator.visibility = View.GONE
                        binding.debugExceptionView.visibility = View.GONE

                        android.util.Log.i("PlayerViewTrace", "PlaybackStarted")
                        android.util.Log.i("PlayerViewTrace", "playerNull=${binding.playerView.player == null}")

                        binding.playerView.post {
                            android.util.Log.i("PlayerViewTrace",
                                "After layout: width=${binding.playerView.width}, height=${binding.playerView.height}, visibility=${binding.playerView.visibility}")
                        }
                    }
                    is PlayerEvent.StartupException -> {
                        if (com.digitalsignage.player.BuildConfig.DEBUG) {
                            binding.loadingIndicator.visibility = View.GONE
                            binding.debugExceptionView.visibility = View.VISIBLE

                            binding.tvDebugState.text = getString(R.string.debug_state_format, event.state)
                            binding.tvDebugCommand.text = getString(R.string.debug_command_format, event.command)
                            binding.tvDebugBaseUrl.text =
                                getString(R.string.debug_base_url_format, com.digitalsignage.player.BuildConfig.BASE_URL)
                            binding.tvDebugExceptionClass.text = event.exceptionClass
                            binding.tvDebugExceptionMessage.text = event.exceptionMessage
                            binding.tvDebugExceptionTrace.setText(R.string.debug_diagnostics_running)

                            lifecycleScope.launch(Dispatchers.IO) {
                                com.digitalsignage.player.core.diagnostics.DiagnosticsFramework.runDiagnostics(this@PlaybackActivity) { report ->
                                    lastDiagnosticsReport = report
                                    lifecycleScope.launch(Dispatchers.Main) {
                                        binding.tvDebugExceptionTrace.text = report
                                        binding.tvDebugCleartext.setText(R.string.debug_diagnostics_complete)
                                    }
                                }
                            }
                        }
                    }
                    is PlayerEvent.DebugStage -> {
                        if (com.digitalsignage.player.BuildConfig.DEBUG) {
                            val currentText = binding.tvDebugExceptionMessage.text.toString()
                            binding.tvDebugExceptionMessage.text = if (currentText.isEmpty()) event.stageName else "$currentText\n${event.stageName}"
                        }
                    }
                    else -> {}
                }
            }
        }

        lifecycleScope.launch {
            runtimeConfigStore.deviceOrientation.collect { orientation ->
                currentOrientation = orientation
                applyOrientation(orientation)
            }
        }

        binding.root.addOnLayoutChangeListener { _, _, _, _, _, _, _, _, _ ->
            applyOrientation(currentOrientation)
        }

        // OTA check/download/install is scheduled by OtaCoordinator from Application.onCreate();
        // the call below is a defensive no-op if the coordinator is already running.
        otaCoordinator.start()
    }

    override fun onStart() {
        super.onStart()
        playerOrchestrator.attachActivity(this)
    }

    override fun onResume() {
        super.onResume()
        android.util.Log.i("KioskTrace", "Activity resumed: restoring KEEP_SCREEN_ON and immersive mode")
        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        binding.root.keepScreenOn = true
        hideSystemUI()
        screenshotReporter.attach(this)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        android.util.Log.i("KioskTrace", "Window focus changed: hasFocus=$hasFocus")
        if (hasFocus) {
            hideSystemUI()
        }
    }

    override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {
        super.onConfigurationChanged(newConfig)
        android.util.Log.i("KioskTrace", "Configuration changed")
        hideSystemUI()
    }

    private fun hideSystemUI() {
        android.util.Log.i("KioskTrace", "Immersive mode entered/restored")
        val windowInsetsController = WindowCompat.getInsetsController(window, window.decorView)
        windowInsetsController.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        windowInsetsController.hide(WindowInsetsCompat.Type.systemBars())
    }

    override fun onStop() {
        super.onStop()
        playerOrchestrator.detachActivity(this)
    }

    override fun onDestroy() {
        super.onDestroy()
        screenshotReporter.detach(this)
        try {
            unregisterReceiver(screenEventsReceiver)
        } catch (e: Exception) {
            // ignore if not registered
        }
        binding.playerView.player = null
        kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main).launch {
            playbackController.release()
        }
    }

    override fun onUserInteraction() {
        super.onUserInteraction()
        playerOrchestrator.onUserInteraction()
    }

    override fun onKeyLongPress(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            playerOrchestrator.requestMaintenance()
            return true
        }
        return super.onKeyLongPress(keyCode, event)
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            event?.startTracking()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK && event?.isTracking == true && !event.isCanceled) {
            // Normal back press, ignore or handle if needed
            return true
        }
        return super.onKeyUp(keyCode, event)
    }

    private fun showMaintenanceDialog() {
        MaintenanceDialog(this, runtimeConfigStore) {
            // Success callback - already handled by MaintenanceSessionManager
        }.show()
    }

    private fun getNetworkDiagnostics(): String {
        val context = this
        val sb = java.lang.StringBuilder()
        try {
            val cm = context.getSystemService(android.content.Context.CONNECTIVITY_SERVICE) as android.net.ConnectivityManager
            val activeNetwork = cm.activeNetwork
            val capabilities = cm.getNetworkCapabilities(activeNetwork)
            
            val isConnected = activeNetwork != null
            val isValidated = capabilities?.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_VALIDATED) == true
            
            sb.append("Network Connected: ").append(if (isConnected) "YES" else "NO").append("\n")
            sb.append("Internet Validated: ").append(if (isValidated) "YES" else "NO").append("\n")
            
            // Wi-Fi SSID
            val wifiManager = context.applicationContext.getSystemService(android.content.Context.WIFI_SERVICE) as android.net.wifi.WifiManager
            val wifiInfo = wifiManager.connectionInfo
            val ssid = wifiInfo?.ssid ?: "<none>"
            sb.append("Wi-Fi SSID: ").append(ssid).append("\n")
            
            // DNS Servers
            val linkProps = cm.getLinkProperties(activeNetwork)
            val dnsServers = linkProps?.dnsServers ?: emptyList()
            sb.append("DNS Servers: ").append(dnsServers.map { it.hostAddress ?: "" }).append("\n")
            
            // Try resolving BASE_URL domain
            val baseUri = java.net.URI(com.digitalsignage.player.BuildConfig.BASE_URL)
            val host = baseUri.host
            sb.append("BASE_URL Host: ").append(host).append("\n")
            if (!host.isNullOrEmpty()) {
                try {
                    val resolved = java.net.InetAddress.getAllByName(host)
                    sb.append("Resolved IP(s): ").append(resolved.map { it.hostAddress ?: "" }).append("\n")
                } catch (e: Exception) {
                    sb.append("Resolved IP(s): FAILED (${e.message})\n")
                }
            }
        } catch (e: Exception) {
            sb.append("Telemetry Err: ").append(e.message).append("\n")
        }
        return sb.toString()
    }

    private var lastDiagnosticsReport: String = ""

    private fun copyDiagnosticsToClipboard() {
        if (lastDiagnosticsReport.isEmpty()) return
        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
        val clip = android.content.ClipData.newPlainText("Diagnostics Report", lastDiagnosticsReport)
        clipboard.setPrimaryClip(clip)
        android.widget.Toast.makeText(this, R.string.debug_report_copied, android.widget.Toast.LENGTH_SHORT).show()
    }

    private fun saveDiagnosticsToDownloads() {
        if (lastDiagnosticsReport.isEmpty()) return
        try {
            val fileName = "diagnostics_report_${System.currentTimeMillis()}.txt"
            val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            var file = File(downloadsDir, fileName)
            
            if (!downloadsDir.exists() || !downloadsDir.canWrite()) {
                val sandboxDir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
                if (sandboxDir != null) {
                    file = File(sandboxDir, fileName)
                }
            }
            
            FileOutputStream(file).use { fos ->
                fos.write(lastDiagnosticsReport.toByteArray())
            }
            android.widget.Toast.makeText(
                this,
                getString(R.string.debug_report_saved, file.name),
                android.widget.Toast.LENGTH_LONG
            ).show()
        } catch (e: Exception) {
            android.util.Log.e("RegisterTrace", "Failed to save diagnostics file", e)
            android.widget.Toast.makeText(
                this,
                getString(R.string.debug_report_save_failed, e.message ?: ""),
                android.widget.Toast.LENGTH_LONG
            ).show()
        }
    }

    // -------------------------------------------------------------------------------------------
    // Status / media rendering
    // -------------------------------------------------------------------------------------------

    /**
     * Renders every [PresentationState] branch. Media states show the player/image surfaces;
     * every other state shows the status screen inside [ActivityPlaybackBinding.statusView]
     * (which lives inside playbackRootContainer, so it rotates with the content).
     */
    private fun renderState(state: PresentationState) {
        android.util.Log.i("PlaybackActivity", "UI rendering state: ${state::class.java.simpleName}")
        when (state) {
            is PresentationState.Image -> {
                hideStatusScreen()
                binding.loadingIndicator.visibility = View.GONE
                binding.imageView.visibility = View.VISIBLE
                binding.playerView.visibility = View.VISIBLE
                binding.imageView.load(state.file) {
                    crossfade(true)
                    placeholder(android.R.color.black)
                    error(android.R.color.black)
                }
            }

            is PresentationState.Video -> {
                hideStatusScreen()
                binding.loadingIndicator.visibility = View.GONE
                clearImage()
                binding.playerView.visibility = View.VISIBLE
            }

            // Transient: keep whatever is on screen and show only the small spinner, so
            // switching between playlist items never flashes the full status screen.
            is PresentationState.Loading -> {
                hideStatusScreen()
                binding.loadingIndicator.visibility = View.VISIBLE
            }

            is PresentationState.Booting -> showStatus(
                busy = true,
                iconRes = R.drawable.ic_status_waiting,
                primary = getString(R.string.status_booting_title),
                secondary = getString(R.string.status_booting_subtitle)
            )

            is PresentationState.Registering -> showStatus(
                busy = true,
                iconRes = R.drawable.ic_status_waiting,
                primary = getString(R.string.status_registering_title),
                secondary = getString(R.string.status_registering_subtitle)
            )

            is PresentationState.Syncing -> showStatus(
                busy = true,
                iconRes = R.drawable.ic_status_waiting,
                primary = getString(R.string.status_syncing_title),
                secondary = getString(R.string.status_syncing_subtitle)
            )

            is PresentationState.Downloading -> showStatus(
                busy = true,
                iconRes = R.drawable.ic_status_waiting,
                primary = if (state.total > 0) {
                    getString(
                        R.string.status_downloading_title,
                        (state.completed + 1).coerceAtMost(state.total),
                        state.total
                    )
                } else {
                    getString(R.string.status_downloading_title_unknown)
                },
                secondary = getString(R.string.status_downloading_subtitle),
                progressPercent = state.percent
            )

            is PresentationState.Offline -> showStatus(
                busy = false,
                iconRes = R.drawable.ic_status_offline,
                primary = getString(R.string.status_offline_title),
                secondary = getString(R.string.status_offline_subtitle)
            )

            is PresentationState.Error -> showStatus(
                busy = false,
                iconRes = R.drawable.ic_status_error,
                primary = getString(R.string.status_error_title),
                secondary = state.message
            )

            is PresentationState.NoContent, is PresentationState.Idle -> showStatus(
                busy = false,
                iconRes = R.drawable.ic_status_waiting,
                primary = getString(R.string.status_no_content_title),
                secondary = getString(R.string.status_no_content_subtitle)
            )
        }
    }

    private fun clearImage() {
        binding.imageView.visibility = View.GONE
        binding.imageView.dispose()
        binding.imageView.setImageDrawable(null)
    }

    private fun hideStatusScreen() {
        binding.statusView.visibility = View.GONE
    }

    private fun showStatus(
        busy: Boolean,
        iconRes: Int,
        primary: CharSequence,
        secondary: CharSequence,
        progressPercent: Int? = null
    ) {
        binding.playerView.visibility = View.GONE
        clearImage()
        binding.loadingIndicator.visibility = View.GONE

        binding.statusSpinner.visibility = if (busy) View.VISIBLE else View.GONE
        binding.statusIcon.visibility = if (busy) View.GONE else View.VISIBLE
        if (!busy) binding.statusIcon.setImageResource(iconRes)

        binding.tvStatusPrimary.text = primary
        binding.tvStatusSecondary.text = secondary

        if (progressPercent != null) {
            binding.pbDownloadProgress.visibility = View.VISIBLE
            binding.pbDownloadProgress.progress = progressPercent.coerceIn(0, 100)
        } else {
            binding.pbDownloadProgress.visibility = View.GONE
        }

        binding.statusView.visibility = View.VISIBLE
    }

    /** Fills the bottom identity bar from DeviceIdentityManager / RuntimeConfigStore. */
    private fun bindIdentityBar() {
        val metadata = try {
            deviceIdentityManager.getDeviceMetadata()
        } catch (e: Exception) {
            android.util.Log.w("PlaybackActivity", "Device metadata unavailable", e)
            null
        }

        binding.tvDeviceName.text = listOfNotNull(
            android.os.Build.MANUFACTURER?.takeIf { it.isNotBlank() },
            android.os.Build.MODEL?.takeIf { it.isNotBlank() }
        ).joinToString(" ").ifBlank { getString(R.string.identity_device_name_unknown) }

        binding.tvAppVersion.text = getString(
            R.string.identity_version_format,
            metadata?.appVersion ?: com.digitalsignage.player.BuildConfig.VERSION_NAME
        )

        binding.tvDeviceIp.text = localIpAddress()
            ?.let { getString(R.string.identity_ip_format, it) }
            ?: getString(R.string.identity_ip_unknown)

        lifecycleScope.launch {
            runtimeConfigStore.deviceId.collect { id ->
                binding.tvDeviceIdChip.text = id?.takeIf { it.isNotBlank() }
                    ?: getString(R.string.identity_device_id_placeholder)
            }
        }

        lifecycleScope.launch {
            networkMonitor.isOnline.collect { online ->
                binding.viewOnlineDot.setBackgroundResource(
                    if (online) R.drawable.dot_status_online else R.drawable.dot_status_offline
                )
                binding.tvOnlineLabel.setText(
                    if (online) R.string.identity_online else R.string.identity_offline
                )
                binding.tvDeviceIp.text = localIpAddress()
                    ?.let { getString(R.string.identity_ip_format, it) }
                    ?: getString(R.string.identity_ip_unknown)
            }
        }
    }

    /** First non-loopback IPv4 address of an up interface, or null. */
    private fun localIpAddress(): String? = try {
        java.net.NetworkInterface.getNetworkInterfaces()
            ?.toList()
            ?.asSequence()
            ?.filter { it.isUp && !it.isLoopback }
            ?.flatMap { it.inetAddresses.toList().asSequence() }
            ?.firstOrNull { !it.isLoopbackAddress && it is java.net.Inet4Address }
            ?.hostAddress
    } catch (e: Exception) {
        android.util.Log.w("PlaybackActivity", "Unable to resolve local IP address", e)
        null
    }
    private fun applyOrientation(orientation: String) {
        val rotationDegrees = when (orientation) {
            DeviceOrientation.LANDSCAPE -> 0f
            DeviceOrientation.PORTRAIT_RIGHT -> 90f
            DeviceOrientation.PORTRAIT_LEFT -> 270f
            DeviceOrientation.UPSIDE_DOWN -> 180f
            else -> 0f
        }

        val playbackRoot = binding.playbackRootContainer
        playbackRoot.rotation = rotationDegrees

        val containerWidth = binding.root.width
        val containerHeight = binding.root.height

        if (containerWidth == 0 || containerHeight == 0) return

        val isRotated = rotationDegrees == 90f || rotationDegrees == 270f
        val desiredWidth = if (isRotated) containerHeight else containerWidth
        val desiredHeight = if (isRotated) containerWidth else containerHeight

        val lp = playbackRoot.layoutParams as FrameLayout.LayoutParams
        if (lp.width != desiredWidth || lp.height != desiredHeight) {
            lp.width = desiredWidth
            lp.height = desiredHeight
            lp.gravity = Gravity.CENTER
            playbackRoot.layoutParams = lp
        }
    }
}

