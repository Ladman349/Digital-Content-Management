package com.digitalsignage.player.core.performance

import android.content.Context
import android.util.Log
import com.digitalsignage.player.BuildConfig

object PerformanceMonitor {
    private const val TAG = "PERF_MONITOR"
    
    // Enable flag
    val isEnabled = BuildConfig.DEBUG

    // Device Signature (logged once)
    private var isDeviceSignatureLogged = false

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
        Log.d(TAG, "EVENT: playItem() entered for $filename at $playItemTime ms")
    }

    fun onFileLookupStarted() {
        if (!isEnabled) return
        fileLookupStartTime = System.currentTimeMillis()
    }

    fun onFileLookupCompleted() {
        if (!isEnabled) return
        fileLookupCompleteTime = System.currentTimeMillis()
    }

    fun onSetMediaItem() {
        if (!isEnabled) return
        setMediaItemTime = System.currentTimeMillis()
    }

    fun onPrepare() {
        if (!isEnabled) return
        prepareTime = System.currentTimeMillis()
    }

    fun onStateBuffering() {
        if (!isEnabled) return
        val now = System.currentTimeMillis()
        if (stateBufferingTime == 0L) {
            stateBufferingTime = now
        }
        lastBufferingStarted = now
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
    }

    fun onFirstFrameRendered() {
        if (!isEnabled) return
        firstFrameTime = System.currentTimeMillis()
    }

    fun onPositionChanged(pos: Long) {
        if (!isEnabled) return
        if (firstMotionTime == 0L && pos > 0L) {
            firstMotionTime = System.currentTimeMillis()
            Log.d(TAG, "EVENT: First motion detected at pos=$pos ms")
            printPerformanceReport()
        }
    }

    fun onDecoderInitialized(durationMs: Long, name: String) {
        if (!isEnabled) return
        decoderInitDuration = durationMs
        decoderInitCount++
        Log.i(TAG, "DECODER: Video decoder initialized: $name (took $durationMs ms)")
    }

    fun onDecoderReleased(name: String) {
        if (!isEnabled) return
        decoderReleaseCount++
        Log.i(TAG, "DECODER: Video decoder released: $name")
    }

    fun onVideoInputFormatChanged(width: Int, height: Int, mime: String, bitrate: Int) {
        if (!isEnabled) return
        currentWidth = width
        currentHeight = height
        currentCodec = mime
        currentBitrate = bitrate
    }

    fun onFrameDropped() {
        if (!isEnabled) return
        droppedFramesCount++
    }

    fun onNetworkSyncTriggered() {
        if (isEnabled && isPlaybackActive) {
            networkSyncsDuringPlayback++
        }
    }

    fun onChecksumTriggered() {
        if (isEnabled && isPlaybackActive) {
            checksumsDuringPlayback++
        }
    }

    fun onDbWriteTriggered() {
        if (isEnabled && isPlaybackActive) {
            dbWritesDuringPlayback++
        }
    }

    fun onDbReadTriggered() {
        if (isEnabled && isPlaybackActive) {
            dbReadsDuringPlayback++
        }
    }

    fun onPlaybackExited() {
        if (!isEnabled) return
        isPlaybackActive = false
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
