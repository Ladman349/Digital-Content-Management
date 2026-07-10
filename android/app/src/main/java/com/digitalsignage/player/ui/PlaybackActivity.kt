package com.digitalsignage.player.ui

import android.content.Context
import android.os.Bundle
import android.os.Environment
import android.view.KeyEvent
import java.io.File
import java.io.FileOutputStream
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.media3.ui.PlayerView
import com.digitalsignage.player.core.event.PlayerEvent
import com.digitalsignage.player.core.event.PlayerEventBus
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

@AndroidEntryPoint
class PlaybackActivity : AppCompatActivity() {

    private lateinit var binding: ActivityPlaybackBinding

    @Inject lateinit var playerOrchestrator: PlayerOrchestrator
    @Inject lateinit var playbackController: PlaybackController
    @Inject lateinit var eventBus: PlayerEventBus
    @Inject lateinit var runtimeConfigStore: RuntimeConfigStoreImpl

    private val viewModel: PlaybackViewModel by viewModels()

    private var currentOrientation: String = DeviceOrientation.LANDSCAPE

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPlaybackBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnCopyDiagnostics.setOnClickListener {
            copyDiagnosticsToClipboard()
        }
        binding.btnSaveDiagnostics.setOnClickListener {
            saveDiagnosticsToDownloads()
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
                        binding.loadingIndicator.visibility = android.view.View.GONE
                        binding.debugExceptionView.visibility = android.view.View.GONE

                        android.util.Log.i("PlayerViewTrace", "PlaybackStarted")
                        android.util.Log.i("PlayerViewTrace", "playerNull=${binding.playerView.player == null}")

                        binding.playerView.post {
                            android.util.Log.i("PlayerViewTrace",
                                "After layout: width=${binding.playerView.width}, height=${binding.playerView.height}, visibility=${binding.playerView.visibility}")
                        }
                    }
                    is PlayerEvent.StartupException -> {
                        if (com.digitalsignage.player.BuildConfig.DEBUG) {
                            binding.loadingIndicator.visibility = android.view.View.GONE
                            binding.debugExceptionView.visibility = android.view.View.VISIBLE
                            
                            binding.tvDebugState.text = "State: ${event.state}"
                            binding.tvDebugCommand.text = "Command: ${event.command}"
                            binding.tvDebugBaseUrl.text = "BASE_URL: ${com.digitalsignage.player.BuildConfig.BASE_URL}"
                            binding.tvDebugExceptionClass.text = event.exceptionClass
                            binding.tvDebugExceptionMessage.text = event.exceptionMessage
                            binding.tvDebugExceptionTrace.text = "Initializing diagnostics framework..."
                            
                            lifecycleScope.launch(Dispatchers.IO) {
                                com.digitalsignage.player.core.diagnostics.DiagnosticsFramework.runDiagnostics(this@PlaybackActivity) { report ->
                                    lastDiagnosticsReport = report
                                    lifecycleScope.launch(Dispatchers.Main) {
                                        binding.tvDebugExceptionTrace.text = report
                                        binding.tvDebugCleartext.text = "Diagnostics run complete."
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
    }

    override fun onStart() {
        super.onStart()
        playerOrchestrator.attachActivity(this)
    }

    override fun onStop() {
        super.onStop()
        playerOrchestrator.detachActivity()
    }

    override fun onDestroy() {
        super.onDestroy()
        binding.playerView.player = null
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
        android.widget.Toast.makeText(this, "Diagnostics report copied!", android.widget.Toast.LENGTH_SHORT).show()
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
            android.widget.Toast.makeText(this, "Report saved: ${file.name}", android.widget.Toast.LENGTH_LONG).show()
        } catch (e: Exception) {
            android.util.Log.e("RegisterTrace", "Failed to save diagnostics file", e)
            android.widget.Toast.makeText(this, "Save failed: ${e.message}", android.widget.Toast.LENGTH_LONG).show()
        }
    }

    private fun renderState(state: PresentationState) {
        android.util.Log.i("PlaybackActivity", "UI rendering state: ${state::class.java.simpleName}")
        when (state) {
            is PresentationState.Idle -> {
                binding.playerView.visibility = android.view.View.GONE
                binding.imageView.visibility = android.view.View.GONE
                binding.imageView.dispose()
                binding.imageView.setImageDrawable(null)
                binding.loadingIndicator.visibility = android.view.View.GONE
                binding.idleView.visibility = android.view.View.VISIBLE
            }
            is PresentationState.Loading -> {
                binding.idleView.visibility = android.view.View.GONE
                binding.loadingIndicator.visibility = android.view.View.VISIBLE
            }
            is PresentationState.Image -> {
                binding.idleView.visibility = android.view.View.GONE
                binding.loadingIndicator.visibility = android.view.View.GONE
                
                binding.imageView.visibility = android.view.View.VISIBLE
                binding.playerView.visibility = android.view.View.VISIBLE
                
                binding.imageView.load(state.file) {
                    crossfade(true)
                    placeholder(android.R.color.black)
                    error(android.R.color.black)
                }
            }
            is PresentationState.Video -> {
                binding.idleView.visibility = android.view.View.GONE
                binding.loadingIndicator.visibility = android.view.View.GONE
                
                binding.imageView.visibility = android.view.View.GONE
                binding.imageView.dispose()
                binding.imageView.setImageDrawable(null)
                
                binding.playerView.visibility = android.view.View.VISIBLE
            }
        }
    }

    private fun applyOrientation(orientation: String) {
        val rotationDegrees = when (orientation) {
            DeviceOrientation.LANDSCAPE -> 0f
            DeviceOrientation.PORTRAIT_RIGHT -> 90f
            DeviceOrientation.PORTRAIT_LEFT -> 270f
            DeviceOrientation.UPSIDE_DOWN -> 180f
            else -> 0f
        }

        android.util.Log.i("PlaybackOrientation", "Applied rotation=${rotationDegrees.toInt()}°")

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

