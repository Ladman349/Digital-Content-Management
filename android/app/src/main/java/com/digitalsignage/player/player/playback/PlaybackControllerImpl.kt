package com.digitalsignage.player.player.playback

import android.content.Context
import androidx.media3.common.C
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import com.digitalsignage.player.core.event.PlayerEvent
import com.digitalsignage.player.core.event.PlayerEventBus
import com.digitalsignage.player.core.logging.Logger
import com.digitalsignage.player.domain.model.MediaItem
import com.digitalsignage.player.domain.model.MediaType
import com.digitalsignage.player.domain.playback.ContentRenderer
import com.digitalsignage.player.domain.playback.PlaybackController
import com.digitalsignage.player.presentation.PlaybackStateStore
import com.digitalsignage.player.presentation.PresentationState
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.*
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

@Singleton
class PlaybackControllerImpl @Inject constructor(
    @ApplicationContext private val context: Context,
    private val eventBus: PlayerEventBus,
    private val logger: Logger,
    private val playbackStateStore: PlaybackStateStore
) : PlaybackController {

    var exoPlayer: ExoPlayer? = null
        private set

    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private var activeContinuation: CancellableContinuation<Unit>? = null
    private var currentRenderer: ContentRenderer? = null
    private var isPlayingActive = false
    private var currentMediaId: String? = null
    private var currentPlaylistId: String? = null

    private val imageRenderer = ImageRendererImpl { file ->
        playbackStateStore.updateState(PresentationState.Image(file))
    }

    private val videoRenderer by lazy {
        VideoRendererImpl(exoPlayer!!) { file ->
            playbackStateStore.updateState(PresentationState.Video(file))
        }
    }

    private val playerListener = object : Player.Listener {
        override fun onPlaybackStateChanged(playbackState: Int) {
            val stateStr = when(playbackState) {
                Player.STATE_IDLE -> "STATE_IDLE"
                Player.STATE_BUFFERING -> "STATE_BUFFERING"
                Player.STATE_READY -> "STATE_READY"
                Player.STATE_ENDED -> "STATE_ENDED"
                else -> "UNKNOWN"
            }
            android.util.Log.i("PlaybackController", "ExoPlayer state: $stateStr")
            
            if (playbackState == Player.STATE_READY) {
                val duration = exoPlayer?.duration ?: 0L
                val position = exoPlayer?.currentPosition ?: 0L
                val width = exoPlayer?.videoSize?.width ?: 0
                val height = exoPlayer?.videoSize?.height ?: 0
                android.util.Log.d("PLAYER", "STATE_READY: Position=$position, Duration=$duration, Size=${width}x${height}")
            }
            
            if (playbackState == Player.STATE_ENDED) {
                val duration = exoPlayer?.duration ?: 0L
                val position = exoPlayer?.currentPosition ?: 0L
                android.util.Log.d("PLAYER", "STATE_ENDED: Position=$position, Duration=$duration")
                
                val cont = activeContinuation
                if (cont != null && cont.isActive) {
                    activeContinuation = null
                    isPlayingActive = false
                    scope.launch {
                        if (cont.isActive) {
                            cont.resume(Unit)
                        }
                    }
                }
            }
        }

        override fun onPlayerError(error: PlaybackException) {
            android.util.Log.e("PlaybackController", "ExoPlayer error occurred", error)
            val cont = activeContinuation
            if (cont != null && cont.isActive) {
                activeContinuation = null
                isPlayingActive = false
                scope.launch {
                    cont.resumeWithException(error)
                }
            }
        }
    }

    override fun initialize() {
        if (exoPlayer != null) return

        val loadControl = DefaultLoadControl.Builder()
            .setBufferDurationsMs(
                DefaultLoadControl.DEFAULT_MIN_BUFFER_MS,
                DefaultLoadControl.DEFAULT_MAX_BUFFER_MS,
                DefaultLoadControl.DEFAULT_BUFFER_FOR_PLAYBACK_MS,
                DefaultLoadControl.DEFAULT_BUFFER_FOR_PLAYBACK_AFTER_REBUFFER_MS
            ).build()

        exoPlayer = ExoPlayer.Builder(context)
            .setLoadControl(loadControl)
            .build().apply {
            setWakeMode(C.WAKE_MODE_LOCAL)
            addListener(playerListener)
        }
        eventBus.publish(PlayerEvent.EngineInitialized)
    }

    override suspend fun playItem(item: MediaItem) {
        val callerStack = Thread.currentThread().stackTrace
            .drop(2)
            .take(5)
            .joinToString("\n") { "    at ${it.className}.${it.methodName}(${it.fileName}:${it.lineNumber})" }
        android.util.Log.d("PLAYER", "playItem called for ${item.mediaId} (Duration=${item.durationMs}ms):\n$callerStack")
        
        isPlayingActive = true
        currentMediaId = item.mediaId
        playbackStateStore.updateState(PresentationState.Loading)

        val startTime = System.currentTimeMillis()
        scope.launch {
            logger.i("Heartbeat", "Playback started: ${item.mediaId} ($startTime)")
        }

        currentRenderer?.stop()
        
        val file = item.localFilePath?.let { java.io.File(it) }
        if (file == null || !file.exists()) {
            isPlayingActive = false
            throw Exception("Local file not found at: ${item.localFilePath}")
        }

        val renderer = when (item.mediaType) {
            MediaType.IMAGE -> imageRenderer
            MediaType.VIDEO -> videoRenderer
            else -> {
                isPlayingActive = false
                return
            }
        }

        currentRenderer = renderer

        try {
            // Log file details before playback starts
            val fileSize = file.length()
            val exists = file.exists()
            android.util.Log.i(
                "PLAYER",
                "PRE-PLAY: MediaID=${item.mediaId}, PlaylistID=$currentPlaylistId, Path=${file.absolutePath}, Exists=$exists, Size=$fileSize bytes, ExpectedDuration=${item.durationMs}ms, ExpectedSHA256=${item.sha256Hash}"
            )

            suspendCancellableCoroutine<Unit> { continuation ->
                activeContinuation = continuation
                
                try {
                    renderer.render(file)
                    eventBus.publish(PlayerEvent.PlaybackStarted(item.mediaId))

                    if (item.mediaType == MediaType.IMAGE) {
                        scope.launch {
                            delay(item.durationMs)
                            if (continuation.isActive) {
                                activeContinuation = null
                                isPlayingActive = false
                                
                                val endTime = System.currentTimeMillis()
                                logger.i("Heartbeat", "Playback completed (Image): ${item.mediaId} ($endTime)")
                                
                                continuation.resume(Unit)
                            }
                        }
                    } else {
                        scope.launch {
                            // Wait briefly for ExoPlayer to prepare and load duration
                            var actualDurationMs = 0L
                            for (i in 1..30) { // check every 100ms for 3 seconds
                                delay(100)
                                val duration = exoPlayer?.duration ?: 0L
                                if (duration > 0 && duration != androidx.media3.common.C.TIME_UNSET) {
                                    actualDurationMs = duration
                                    break
                                }
                            }

                            val finalDurationMs = if (actualDurationMs > 0) {
                                actualDurationMs
                            } else {
                                // Fallback to database duration, but guarantee at least 5 minutes to prevent premature cutoffs
                                maxOf(item.durationMs, 300000L)
                            }
                            // Allow a safe 20 seconds of buffer over the actual duration for slow devices or buffering
                            val watchdogDelay = finalDurationMs + 20000L
                            
                            android.util.Log.d("PLAYER", "Watchdog scheduled for ${watchdogDelay}ms (MediaDuration=${finalDurationMs}ms)")

                            delay(watchdogDelay)
                            if (continuation.isActive) {
                                val duration = exoPlayer?.duration ?: 0L
                                val position = exoPlayer?.currentPosition ?: 0L
                                android.util.Log.w("PLAYER", "WATCHDOG TRIGGERED: Position=$position, Duration=$duration")
                                activeContinuation = null
                                isPlayingActive = false
                                logger.w("Heartbeat", "Watchdog triggered. Video playback timed out for ${item.mediaId} after ${watchdogDelay}ms")
                                continuation.resume(Unit)
                            }
                        }
                    }
                } catch (t: Throwable) {
                    isPlayingActive = false
                    continuation.resumeWithException(t)
                }
            }
        } finally {
            withContext(NonCancellable) {
                stop()
            }
        }
    }

    override fun isPlaying(): Boolean = isPlayingActive

    override fun getCurrentMediaId(): String? = currentMediaId

    override fun getCurrentPlaylistId(): String? = currentPlaylistId

    override fun setCurrentPlaylistId(playlistId: String?) {
        this.currentPlaylistId = playlistId
    }

    override suspend fun stop() {
        withContext(Dispatchers.Main.immediate) {
            val duration = exoPlayer?.duration ?: 0L
            val position = exoPlayer?.currentPosition ?: 0L
            val callerStack = Thread.currentThread().stackTrace
                .drop(2)
                .take(5)
                .joinToString("\n") { "    at ${it.className}.${it.methodName}(${it.fileName}:${it.lineNumber})" }
            android.util.Log.d("PLAYER", "STOP called: Position=$position, Duration=$duration\n$callerStack")
            
            currentRenderer?.stop()
            currentRenderer = null
            isPlayingActive = false
            currentMediaId = null
            activeContinuation = null
            playbackStateStore.updateState(PresentationState.Idle)
        }
    }

    override suspend fun release() {
        withContext(Dispatchers.Main.immediate) {
            stop()
            exoPlayer?.removeListener(playerListener)
            exoPlayer?.release()
            exoPlayer = null
        }
    }
}
