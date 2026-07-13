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
    private var pollerJob: Job? = null

    private fun startPoller() {
        if (!com.digitalsignage.player.core.performance.PerformanceMonitor.isEnabled) return
        pollerJob?.cancel()
        pollerJob = scope.launch(Dispatchers.Main.immediate) {
            while (isActive) {
                delay(500)
                if (isPlayingActive) {
                    val bufferedDur = exoPlayer?.totalBufferedDuration ?: 0L
                    com.digitalsignage.player.core.performance.PerformanceMonitor.recordHeartbeat(bufferedDur)
                }
            }
        }
    }

    private fun stopPoller() {
        pollerJob?.cancel()
        pollerJob = null
    }

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
            when (playbackState) {
                Player.STATE_BUFFERING -> {
                    com.digitalsignage.player.core.performance.PerformanceMonitor.onStateBuffering()
                }
                Player.STATE_READY -> {
                    com.digitalsignage.player.core.performance.PerformanceMonitor.onStateReady()
                }
            }
            if (playbackState == Player.STATE_ENDED) {
                val cont = activeContinuation
                if (cont != null && cont.isActive) {
                    activeContinuation = null
                    isPlayingActive = false
                    val endTime = System.currentTimeMillis()
                    logger.i("Heartbeat", "Playback completed (Video): $currentMediaId ($endTime)")
                    scope.launch {
                        cont.resume(Unit)
                    }
                }
            }
        }

        override fun onMediaItemTransition(mediaItem: androidx.media3.common.MediaItem?, reason: Int) {
            if (mediaItem != null) {
                val transitionedMediaId = mediaItem.mediaId
                logger.i("PlaybackController", "ExoPlayer transitioned to mediaItem: $transitionedMediaId, reason: $reason")
                com.digitalsignage.player.core.performance.PerformanceMonitor.recordEvent("PLAYBACK", "ExoPlayer transitioned to mediaItem: $transitionedMediaId, reason: $reason")
                
                val count = exoPlayer?.mediaItemCount ?: 0
                val currentIndex = exoPlayer?.currentMediaItemIndex ?: 0
                val currentUri = mediaItem.localConfiguration?.uri?.toString() ?: "NONE"
                com.digitalsignage.player.core.performance.PerformanceMonitor.onMediaTransition(count, currentIndex, currentUri)
                
                currentMediaId = transitionedMediaId
            }
        }

        override fun onRenderedFirstFrame() {
            com.digitalsignage.player.core.performance.PerformanceMonitor.onFirstFrameRendered()
        }

        override fun onPlayerError(error: PlaybackException) {
            logger.e("PlaybackController", "ExoPlayer error occurred", error)
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
                addAnalyticsListener(object : androidx.media3.exoplayer.analytics.AnalyticsListener {
                    override fun onVideoDecoderInitialized(
                        eventTime: androidx.media3.exoplayer.analytics.AnalyticsListener.EventTime,
                        decoderName: String,
                        initializationDurationMs: Long
                    ) {
                        com.digitalsignage.player.core.performance.PerformanceMonitor.onDecoderInitialized(initializationDurationMs, decoderName)
                    }

                    override fun onVideoDecoderReleased(
                        eventTime: androidx.media3.exoplayer.analytics.AnalyticsListener.EventTime,
                        decoderName: String
                    ) {
                        com.digitalsignage.player.core.performance.PerformanceMonitor.onDecoderReleased(decoderName)
                    }

                    override fun onVideoInputFormatChanged(
                        eventTime: androidx.media3.exoplayer.analytics.AnalyticsListener.EventTime,
                        format: androidx.media3.common.Format,
                        decoderReuseEvaluation: androidx.media3.exoplayer.DecoderReuseEvaluation?
                    ) {
                        com.digitalsignage.player.core.performance.PerformanceMonitor.onVideoInputFormatChanged(
                            format.width,
                            format.height,
                            format.sampleMimeType ?: "UNKNOWN",
                            format.bitrate
                        )
                    }

                    override fun onDroppedVideoFrames(
                        eventTime: androidx.media3.exoplayer.analytics.AnalyticsListener.EventTime,
                        droppedFrames: Int,
                        elapsedMs: Long
                    ) {
                        repeat(droppedFrames) {
                            com.digitalsignage.player.core.performance.PerformanceMonitor.onFrameDropped()
                        }
                        com.digitalsignage.player.core.performance.PerformanceMonitor.onDroppedVideoFrames(
                            droppedFrames,
                            elapsedMs,
                            eventTime.currentPlaybackPositionMs
                        )
                    }
                })
            }
        eventBus.publish(PlayerEvent.EngineInitialized)
    }

    override fun preloadItem(item: MediaItem) {
        logger.i("PlaybackController", "Preloading disabled (Option A)")
    }

    override suspend fun playItem(item: MediaItem) {
        val filename = item.localFilePath?.let { java.io.File(it).name } ?: "UNKNOWN"
        val fileLength = item.localFilePath?.let { java.io.File(it).length() } ?: 0L
        com.digitalsignage.player.core.performance.PerformanceMonitor.onPlayItemEntered(item.mediaId, filename, fileLength, item.durationMs)
        
        // Start periodic poller for rolling timeline
        startPoller()
        
        isPlayingActive = true
        currentMediaId = item.mediaId
        playbackStateStore.updateState(PresentationState.Loading)

        val startTime = System.currentTimeMillis()
        logger.i("Heartbeat", "Playback started: ${item.mediaId} ($startTime)")

        currentRenderer?.stop()
        
        com.digitalsignage.player.core.performance.PerformanceMonitor.onFileLookupStarted()
        val file = item.localFilePath?.let { java.io.File(it) }
        if (file == null || !file.exists()) {
            com.digitalsignage.player.core.performance.PerformanceMonitor.onFileLookupCompleted()
            isPlayingActive = false
            throw Exception("Local file not found at: ${item.localFilePath}")
        }
        com.digitalsignage.player.core.performance.PerformanceMonitor.onFileLookupCompleted()

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
                        // Monitor currentPosition for first motion
                        scope.launch {
                            while (isActive && isPlayingActive && com.digitalsignage.player.core.performance.PerformanceMonitor.firstMotionTime == 0L) {
                                val pos = exoPlayer?.currentPosition ?: 0L
                                com.digitalsignage.player.core.performance.PerformanceMonitor.onPositionChanged(pos)
                                delay(10)
                            }
                        }

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
                            
                            delay(watchdogDelay)
                            if (continuation.isActive) {
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
            com.digitalsignage.player.core.performance.PerformanceMonitor.onPlaybackExited()
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
            stopPoller()
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
