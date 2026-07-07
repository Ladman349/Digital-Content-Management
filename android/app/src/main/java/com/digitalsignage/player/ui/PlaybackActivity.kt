package com.digitalsignage.player.ui

import android.os.Bundle
import android.view.KeyEvent
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
import com.digitalsignage.player.presentation.PlaybackViewModel
import com.digitalsignage.player.presentation.PresentationState
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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPlaybackBinding.inflate(layoutInflater)
        setContentView(binding.root)

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
                            
                            lifecycleScope.launch(Dispatchers.IO) {
                                val netTelemetry = getNetworkDiagnostics()
                                withContext(Dispatchers.Main) {
                                    binding.tvDebugCleartext.text = netTelemetry.trim()
                                    binding.tvDebugExceptionClass.text = event.exceptionClass
                                    binding.tvDebugExceptionMessage.text = event.exceptionMessage
                                    binding.tvDebugExceptionTrace.text = "Cause: ${event.cause}\n\n${event.stackTrace}"
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
}

