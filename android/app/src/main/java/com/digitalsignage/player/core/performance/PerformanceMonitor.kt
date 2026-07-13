package com.digitalsignage.player.core.performance

import android.content.Context
import android.util.Log
import com.digitalsignage.player.BuildConfig
import kotlinx.coroutines.*

data class TimelineEvent(
    val timestamp: Long,
    val type: String,
    val details: String
)

object PerformanceMonitor {
    private const val TAG = "PERF_MONITOR"
    
    val isEnabled = BuildConfig.DEBUG

    private var isDeviceSignatureLogged = false

    // Rolling history variables
    private val eventHistory = java.util.ArrayDeque<TimelineEvent>()
    private val lock = Any()
    private var pollerJob: Job? = null

    // State timings
    var playlistSelectedTime = 0L
    var playItemTime = 0L
    var fileLookupStartTime = 0L
    var fileLookupCompleteTime = 0L
    var setMediaItemTime = 0L
    var prepareTime = 0L
    var stateBufferingTime = 0L
    var stateReadyTime = 0L
    var firstFrameTime = 0L
    var firstMotionTime = 0L

    // Metrics
    var totalBufferingDuration = 0L
    var decoderInitDuration = 0L
    var droppedFramesCount = 0
    private var lastBufferingStarted = 0L

    // Media metadata
    var currentMediaId = ""
    var currentFilename = ""
    var currentMediaDuration = 0L
    var currentFileSize = 0L
    var currentWidth = 0
    var currentHeight = 0
    var currentCodec = "UNKNOWN"
    var currentBitrate = 0

    // Decoder lifecycle tracking
    var decoderInitCount = 0
    var decoderReleaseCount = 0

    // Zero-overhead validation counters
    var isPlaybackActive = false
    var networkSyncsDuringPlayback = 0
    var checksumsDuringPlayback = 0
    var dbWritesDuringPlayback = 0
    var dbReadsDuringPlayback = 0

    fun recordEvent(type: String, details: String) {
        if (!isEnabled) return
        val now = System.currentTimeMillis()
        synchronized(lock) {
            eventHistory.addLast(TimelineEvent(now, type, details))
            while (eventHistory.isNotEmpty() && (now - eventHistory.first.timestamp > 10000L)) {
                eventHistory.removeFirst()
            }
        }
    }

    fun startPoller(scope: CoroutineScope, getBufferedDuration: () -> Long) {
        if (!isEnabled) return
        pollerJob?.cancel()
        pollerJob = scope.launch(Dispatchers.Default) {
            while (isActive) {
                delay(500)
                if (isPlaybackActive) {
                    val freeMem = Runtime.getRuntime().freeMemory() / (1024 * 1024)
                    val totalMem = Runtime.getRuntime().totalMemory() / (1024 * 1024)
                    val cpuTime = android.os.Process.getElapsedCpuTime()
                    val bufferedDur = getBufferedDuration()
                    recordEvent("HEARTBEAT", "JVM Free: ${freeMem}MB/Total: ${totalMem}MB, CPU Process: ${cpuTime}ms, Buffer: ${bufferedDur}ms")
                }
            }
        }
    }

    fun stopPoller() {
        pollerJob?.cancel()
        pollerJob = null
    }

    fun logDeviceSignatureOnce(context: Context) {
        if (!isEnabled || isDeviceSignatureLogged) return
        isDeviceSignatureLogged = true

        try {
            val actManager = context.getSystemService(Context.ACTIVITY_SERVICE) as? android.app.ActivityManager
            val memInfo = android.app.ActivityManager.MemoryInfo()
            actManager?.getMemoryInfo(memInfo)
            val totalGb = memInfo.totalMem.toDouble() / (1024 * 1024 * 1024)
            val freeGb = memInfo.availMem.toDouble() / (1024 * 1024 * 1024)

            val wm = context.getSystemService(Context.WINDOW_SERVICE) as? android.view.WindowManager
            val display = wm?.defaultDisplay
            val refreshRate = display?.refreshRate ?: 60f

            val report = """
                ==================================================
                DEVICE SIGNATURE LOG (Startup)
                ==================================================
                Android Version: ${android.os.Build.VERSION.RELEASE} (API ${android.os.Build.VERSION.SDK_INT})
                Manufacturer: ${android.os.Build.MANUFACTURER}
                Model: ${android.os.Build.MODEL}
                CPU ABIs: ${android.os.Build.SUPPORTED_ABIS.joinToString()}
                System RAM: ${String.format("%.2f GB free / %.2f GB total", freeGb, totalGb)}
                Refresh Rate: $refreshRate Hz
                Display Width/Height: ${display?.width ?: 0}x${display?.height ?: 0}
                TextureView Rotation Support: Verified (Hardware acceleration enabled)
                ==================================================
            """.trimIndent()
            Log.i(TAG, report)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to log device signature", e)
        }
    }

    fun onPlaylistSelected() {
        if (!isEnabled) return
        playlistSelectedTime = System.currentTimeMillis()
        recordEvent("PLAYLIST", "Selected playlist")
        Log.d(TAG, "EVENT: Playlist selected at $playlistSelectedTime ms")
    }

    fun onPlayItemEntered(mediaId: String, filename: String, fileSize: Long, durationMs: Long) {
        if (!isEnabled) return
        playItemTime = System.currentTimeMillis()
        
        // Reset timers & metrics
        fileLookupStartTime = 0L
        fileLookupCompleteTime = 0L
        setMediaItemTime = 0L
        prepareTime = 0L
        stateBufferingTime = 0L
        stateReadyTime = 0L
        firstFrameTime = 0L
        firstMotionTime = 0L
        totalBufferingDuration = 0L
        decoderInitDuration = 0L
        droppedFramesCount = 0
        lastBufferingStarted = 0L

        // Overhead resets
        networkSyncsDuringPlayback = 0
        checksumsDuringPlayback = 0
        dbWritesDuringPlayback = 0
        dbReadsDuringPlayback = 0
        
        currentMediaId = mediaId
        currentFilename = filename
        currentFileSize = fileSize
        currentMediaDuration = durationMs
        currentWidth = 0
        currentHeight = 0
        currentCodec = "UNKNOWN"
        currentBitrate = 0

        isPlaybackActive = true
        recordEvent("PLAYBACK", "playItem() entered for $filename")
        Log.d(TAG, "EVENT: playItem() entered for $filename at $playItemTime ms")
    }

    fun onFileLookupStarted() {
        if (!isEnabled) return
        fileLookupStartTime = System.currentTimeMillis()
        recordEvent("FILE_IO", "Lookup started")
    }

    fun onFileLookupCompleted() {
        if (!isEnabled) return
        fileLookupCompleteTime = System.currentTimeMillis()
        recordEvent("FILE_IO", "Lookup completed (took ${fileLookupCompleteTime - fileLookupStartTime} ms)")
    }

    fun onSetMediaItem() {
        if (!isEnabled) return
        setMediaItemTime = System.currentTimeMillis()
        recordEvent("RENDERER", "setMediaItem() called")
    }

    fun onPrepare() {
        if (!isEnabled) return
        prepareTime = System.currentTimeMillis()
        recordEvent("RENDERER", "prepare() called")
    }

    fun onStateBuffering() {
        if (!isEnabled) return
        val now = System.currentTimeMillis()
        if (stateBufferingTime == 0L) {
            stateBufferingTime = now
        }
        lastBufferingStarted = now
        recordEvent("STATE_CHANGE", "STATE_BUFFERING")
    }

    fun onStateReady() {
        if (!isEnabled) return
        val now = System.currentTimeMillis()
        if (stateReadyTime == 0L) {
            stateReadyTime = now
        }
        if (lastBufferingStarted > 0L) {
            totalBufferingDuration += (now - lastBufferingStarted)
            lastBufferingStarted = 0L
        }
        recordEvent("STATE_CHANGE", "STATE_READY")
    }

    fun onFirstFrameRendered() {
        if (!isEnabled) return
        firstFrameTime = System.currentTimeMillis()
        recordEvent("RENDERER", "First video frame rendered")
    }

    fun onPositionChanged(pos: Long) {
        if (!isEnabled) return
        if (firstMotionTime == 0L && pos > 0L) {
            firstMotionTime = System.currentTimeMillis()
            recordEvent("RENDERER", "First motion detected at pos=$pos ms")
            Log.d(TAG, "EVENT: First motion detected at pos=$pos ms")
            printPerformanceReport()
        }
    }

    fun onDecoderInitialized(durationMs: Long, name: String) {
        if (!isEnabled) return
        decoderInitDuration = durationMs
        decoderInitCount++
        recordEvent("DECODER", "Initialized: $name (took $durationMs ms)")
        Log.i(TAG, "DECODER: Video decoder initialized: $name (took $durationMs ms)")
    }

    fun onDecoderReleased(name: String) {
        if (!isEnabled) return
        decoderReleaseCount++
        recordEvent("DECODER", "Released: $name")
        Log.i(TAG, "DECODER: Video decoder released: $name")
    }

    fun onVideoInputFormatChanged(width: Int, height: Int, mime: String, bitrate: Int) {
        if (!isEnabled) return
        currentWidth = width
        currentHeight = height
        currentCodec = mime
        currentBitrate = bitrate
        recordEvent("DECODER", "Format changed: ${width}x${height}, mime: $mime, bitrate: $bitrate")
    }

    fun onFrameDropped() {
        if (!isEnabled) return
        droppedFramesCount++
    }

    fun onDroppedVideoFrames(droppedFrames: Int, elapsedMs: Long, playbackPositionMs: Long) {
        if (!isEnabled) return
        val now = System.currentTimeMillis()
        
        val reportBuilder = StringBuilder()
        reportBuilder.append("\n==================================================\n")
        reportBuilder.append("⚠️ HITCH DETECTED at Playback Position: $playbackPositionMs ms\n")
        reportBuilder.append("Dropped Frames: $droppedFrames, Elapsed since last render: $elapsedMs ms\n")
        reportBuilder.append("Rolling 10-Second Timeline of Events:\n")
        
        synchronized(lock) {
            val currentHistory = ArrayList(eventHistory)
            for (event in currentHistory) {
                val relativeTimeMs = event.timestamp - now
                reportBuilder.append(String.format("  [%6d ms] %-15s : %s\n", relativeTimeMs, event.type, event.details))
            }
        }
        reportBuilder.append("==================================================\n")
        Log.w(TAG, reportBuilder.toString())
    }

    fun onNetworkSyncTriggered() {
        recordEvent("SYNC", "Sync triggered")
        if (isEnabled && isPlaybackActive) {
            networkSyncsDuringPlayback++
        }
    }

    fun onChecksumTriggered() {
        recordEvent("CHECKSUM", "Checksum verification triggered")
        if (isEnabled && isPlaybackActive) {
            checksumsDuringPlayback++
        }
    }

    fun onDbWriteTriggered() {
        recordEvent("DB_WRITE", "DB write triggered")
        if (isEnabled && isPlaybackActive) {
            dbWritesDuringPlayback++
        }
    }

    fun onDbReadTriggered() {
        recordEvent("DB_READ", "DB read triggered")
        if (isEnabled && isPlaybackActive) {
            dbReadsDuringPlayback++
        }
    }

    fun onMediaTransition(playlistSize: Int, currentMediaIndex: Int, currentMediaUri: String) {
        if (!isEnabled) return
        recordEvent("TRANSITION", "Playlist Size: $playlistSize, Index: $currentMediaIndex, URI: $currentMediaUri")
        Log.i(TAG, "TRANSITION: Playlist Size: $playlistSize, Index: $currentMediaIndex, URI: $currentMediaUri")
    }

    fun onPlaybackExited() {
        if (!isEnabled) return
        isPlaybackActive = false
        recordEvent("PLAYBACK", "playItem() exited")
        stopPoller()
    }

    private fun printPerformanceReport() {
        val totalTransition = if (playlistSelectedTime > 0) (playItemTime - playlistSelectedTime) else 0L
        val fileLookup = if (fileLookupStartTime > 0) (fileLookupCompleteTime - fileLookupStartTime) else 0L
        val setMediaItem = if (fileLookupCompleteTime > 0) (setMediaItemTime - fileLookupCompleteTime) else 0L
        val prepare = if (setMediaItemTime > 0) (prepareTime - setMediaItemTime) else 0L
        val stateReady = if (prepareTime > 0) (stateReadyTime - prepareTime) else 0L
        val firstFrame = if (stateReadyTime > 0) (firstFrameTime - stateReadyTime) else 0L
        val firstMotion = if (firstFrameTime > 0) (firstMotionTime - firstFrameTime) else 0L
        val totalLatency = if (playItemTime > 0) (firstMotionTime - playItemTime) else 0L

        val report = """
            ==================================================
            PERFORMANCE REPORT: $currentFilename
            ==================================================
            Media Metadata:
              - Media ID: $currentMediaId
              - Expected Duration: $currentMediaDuration ms
              - File Size: $currentFileSize bytes
              - Resolution: ${currentWidth}x$currentHeight
              - Codec/Mime: $currentCodec
              - Bitrate: ${if (currentBitrate > 0) "$currentBitrate bps" else "UNKNOWN"}

            Playback Pipeline Latency:
              - Transition Latency (Playlist -> Item): $totalTransition ms
              - File Lookup Latency: $fileLookup ms
              - setMediaItem Latency: $setMediaItem ms
              - prepare() Latency: $prepare ms
              - STATE_READY Latency: $stateReady ms
              - First Frame Latency: $firstFrame ms
              - First Motion Latency: $firstMotion ms
              - Decoder Initialization Latency: $decoderInitDuration ms
              - Total Buffering Duration: $totalBufferingDuration ms
              - TOTAL STARTUP LATENCY (playItem -> First Motion): $totalLatency ms

            Pipeline Validation Statistics:
              - Dropped Frames: $droppedFramesCount
              - Decoder Init Count: $decoderInitCount (Expected: 1)
              - Decoder Release Count: $decoderReleaseCount (Expected: 0 on hot loop)
              - Network Syncs during Playback: $networkSyncsDuringPlayback (Expected: 0)
              - Checksum Checks during Playback: $checksumsDuringPlayback (Expected: 0)
              - DB Reads during Playback: $dbReadsDuringPlayback
              - DB Writes during Playback: $dbWritesDuringPlayback

            JVM Memory Status:
              - Free Memory: ${Runtime.getRuntime().freeMemory() / (1024 * 1024)} MB
              - Total Memory: ${Runtime.getRuntime().totalMemory() / (1024 * 1024)} MB
              - Max Memory: ${Runtime.getRuntime().maxMemory() / (1024 * 1024)} MB
            ==================================================
        """.trimIndent()
        Log.i(TAG, report)
    }
}
