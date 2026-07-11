package com.digitalsignage.player.workers.download

import com.digitalsignage.player.core.event.PlayerEvent
import com.digitalsignage.player.core.event.PlayerEventBus
import com.digitalsignage.player.core.logging.Logger
import com.digitalsignage.player.core.storage.StorageManager
import com.digitalsignage.player.core.utils.FileValidator
import com.digitalsignage.player.data.local.AppDatabase
import com.digitalsignage.player.data.local.DownloadSessionEntity
import com.digitalsignage.player.domain.model.DownloadState
import com.digitalsignage.player.domain.model.PlaylistState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DownloadManager @Inject constructor(
    private val database: AppDatabase,
    private val storageManager: StorageManager,
    private val fileValidator: FileValidator,
    private val eventBus: PlayerEventBus,
    private val logger: Logger,
    private val client: OkHttpClient
) {
    private val scope = CoroutineScope(Dispatchers.IO)
    private val isRunning = java.util.concurrent.atomic.AtomicBoolean(false)
    
    // Future Bandwidth Management Configurations
    private val maxConcurrentDownloads = 3
    private val enableThrottling = false
    private val enablePrefetch = true

    fun startProcessing() {
        eventBus.publish(PlayerEvent.DebugStage("3a. DownloadManager received startProcessing()"))
        if (!isRunning.compareAndSet(false, true)) {
            eventBus.publish(PlayerEvent.DebugStage("3c. DownloadManager already running, returning early"))
            return
        }
        scope.launch {
            eventBus.publish(PlayerEvent.DebugStage("3b. DownloadManager launch started"))
            eventBus.publish(PlayerEvent.DebugStage("3d. DownloadManager invoking processQueue()"))
            try {
                processQueue()
            } finally {
                isRunning.set(false)
            }
        }
    }
    
    private suspend fun processQueue() {
        eventBus.publish(PlayerEvent.DebugStage("3e. processQueue() while loop starting. isRunning = ${isRunning.get()}"))
        while (isRunning.get()) {
            android.util.Log.i("SyncTrace", "Before getPendingTasks()")
            val pendingSessions = database.downloadSessionDao().getPendingTasks()
            android.util.Log.i("SyncTrace", "getPendingTasks returned ${pendingSessions.size}")
            eventBus.publish(PlayerEvent.DebugStage("3f. Fetched pending tasks. Count: ${pendingSessions.size}"))
            
            if (pendingSessions.isEmpty()) {
                eventBus.publish(PlayerEvent.DebugStage("3g. No pending tasks. Queue empty. Breaking loop and checking readiness."))
                checkPlaylistReadiness()
                break
            }
            
            if (!storageManager.isStorageAvailable()) {
                eventBus.publish(PlayerEvent.DebugStage("3h. Storage full. Returning early."))
                logger.e("DownloadManager", "Storage full. Pausing downloads.")
                pendingSessions.forEach {
                    database.downloadSessionDao().updateSessionState(it.mediaId, DownloadState.PAUSED, System.currentTimeMillis())
                }
                break
            }
            
            // Process concurrently up to maxConcurrentDownloads
            val batch = pendingSessions.take(maxConcurrentDownloads)
            eventBus.publish(PlayerEvent.DebugStage("3i. Processing batch of ${batch.size} items"))
            
            // Await all downloads in this batch
            batch.map { session ->
                scope.async {
                    android.util.Log.i("SyncTrace", "Calling attemptDownload() for mediaId=${session.mediaId}")
                    attemptDownload(session)
                }
            }.awaitAll()
        }
    }
    
    private suspend fun attemptDownload(session: DownloadSessionEntity) {
        android.util.Log.i("SyncTrace", "Entered attemptDownload() mediaId=${session.mediaId}")
        android.util.Log.i("DownloadTrace", "Entering attemptDownload URL=${session.url}")
        val maxRetries = 5
        val now = System.currentTimeMillis()
        
        if (session.retryCount >= maxRetries) {
            logger.e("DownloadManager", "Max retries reached for ${session.mediaId}")
            database.downloadSessionDao().updateSessionState(session.mediaId, DownloadState.FAILED, now)
            eventBus.publish(PlayerEvent.DownloadFailed(session.mediaId, Exception("Max retries exceeded")))
            return
        }
        
        try {
            database.downloadSessionDao().updateSessionState(session.mediaId, DownloadState.DOWNLOADING, now)
            android.util.Log.i("DownloadTrace", "Step: updateSessionState DOWNLOADING")
            eventBus.publish(PlayerEvent.DebugStage("4. DownloadManager attempting download for: ${session.url}"))
            android.util.Log.i("DownloadTrace", "Step: publish DebugStage")
            eventBus.publish(PlayerEvent.DownloadStarted(session.mediaId))
            android.util.Log.i("DownloadTrace", "Step: publish DownloadStarted")
            
            val nameFromUrl = session.url.substringAfterLast('/').substringBefore('?')
            val sanitized = nameFromUrl.replace("[\\\\/:*?\"<>|]".toRegex(), "_")
            val fileName = "${session.mediaId}_$sanitized"
            val destFile = File(storageManager.getMediaDirectory(), fileName)
            val tempFile = File(storageManager.getMediaDirectory(), "${fileName}.tmp")
            android.util.Log.d("DownloadManager", "Destination: ${destFile.absolutePath}")
            android.util.Log.i("DownloadTrace", "Step: destFile=${destFile.absolutePath}, tempFile=${tempFile.absolutePath}")
            
            var downloadedBytes = session.currentByteOffset
            if (tempFile.exists() && downloadedBytes == 0L) {
                downloadedBytes = tempFile.length()
            }
            android.util.Log.i("DownloadTrace", "Step: if tempFile.exists() block finished")
            
            val requestBuilder = Request.Builder().url(session.url)
            if (downloadedBytes > 0) {
                requestBuilder.header("Range", "bytes=${downloadedBytes}-")
                logger.d("DownloadManager", "Resuming download for ${session.mediaId} from offset: ${downloadedBytes}")
            }
            
            android.util.Log.i("DownloadTrace", "Immediately before execute: URL=${session.url}")
            val response = client.newCall(requestBuilder.build()).execute()
            android.util.Log.d("DownloadManager", "HTTP status: ${response.code}")
            android.util.Log.i("DownloadTrace", "Immediately after execute: code=${response.code}, message=${response.message}")
            
            if (!response.isSuccessful && response.code != 206) {
                val errorBody = response.body?.string() ?: "null"
                android.util.Log.e("DownloadTrace", "Unsuccessful response body=${errorBody}")
                throw Exception("HTTP ${response.code}")
            }
            
            val body = response.body
            android.util.Log.i("DownloadTrace", "Step: response.body obtained")
            if (body != null) {
                val contentLength = body.contentLength()
                val expectedSize = if (contentLength > 0) contentLength + downloadedBytes else null
                
                val inputStream: InputStream = body.byteStream()
                android.util.Log.i("DownloadTrace", "Step: inputStream created")
                val outputStream = FileOutputStream(tempFile, downloadedBytes > 0)
                android.util.Log.i("DownloadTrace", "Step: outputStream created")
                
                val buffer = ByteArray(8192)
                var read: Int
                var totalRead = downloadedBytes
                
                var lastReportedProgress = 0
                var lastDbSync = System.currentTimeMillis()
                
                var isFirstRead = true
                android.util.Log.i("DownloadTrace", "Step: entering read loop")
                while (inputStream.read(buffer).also { read = it } != -1) {
                    if (isFirstRead) {
                        android.util.Log.i("DownloadTrace", "Step: first bytes read")
                        isFirstRead = false
                    }
                    if (enableThrottling) {
                        // Sleep slightly to throttle bandwidth (placeholder logic)
                        // delay(5)
                    }
                    
                    outputStream.write(buffer, 0, read)
                    totalRead += read
                    
                    val currentTime = System.currentTimeMillis()
                    if (currentTime - lastDbSync > 5000) {
                        database.downloadSessionDao().updateSessionOffset(session.mediaId, totalRead, currentTime)
                        lastDbSync = currentTime
                    }
                    
                    if (expectedSize != null && expectedSize > 0) {
                        val progress = ((totalRead * 100) / expectedSize).toInt()
                        if (progress - lastReportedProgress >= 5) {
                            lastReportedProgress = progress
                            eventBus.publish(PlayerEvent.DownloadProgress(session.mediaId, progress))
                        }
                    }
                }
                outputStream.flush()
                outputStream.close()
                inputStream.close()
                
                com.digitalsignage.player.core.performance.PerformanceMonitor.onDbWriteTriggered()
                database.downloadSessionDao().updateSessionOffset(session.mediaId, totalRead, System.currentTimeMillis())
                
                // Validate Size and Hash
                com.digitalsignage.player.core.performance.PerformanceMonitor.onChecksumTriggered()
                val isValid = fileValidator.validateFile(
                    file = tempFile,
                    expectedMd5 = session.expectedChecksumMd5,
                    expectedSha256 = session.expectedChecksumSha256,
                    expectedSize = if (expectedSize != null && expectedSize > 0L) expectedSize else null
                )
                
                if (isValid) {
                    tempFile.renameTo(destFile)
                    com.digitalsignage.player.core.performance.PerformanceMonitor.onDbWriteTriggered()
                    database.downloadSessionDao().updateSessionState(session.mediaId, DownloadState.COMPLETED, System.currentTimeMillis())
                    com.digitalsignage.player.core.performance.PerformanceMonitor.onDbWriteTriggered()
                    database.playlistDao().updateMediaDownloadedState(session.mediaId, true, destFile.absolutePath)
                    
                    eventBus.publish(PlayerEvent.DownloadCompleted(session.mediaId))
                    checkPlaylistReadiness()
                } else {
                    tempFile.delete()
                    com.digitalsignage.player.core.performance.PerformanceMonitor.onDbWriteTriggered()
                    database.downloadSessionDao().updateSessionOffset(session.mediaId, 0L, System.currentTimeMillis())
                    throw Exception("Checksum or Size validation failed")
                }
            } else {
                throw Exception("Empty response body")
            }
        } catch (e: Exception) {
            android.util.Log.e("DownloadManager", "Download failed", e)
            android.util.Log.e("DownloadTrace", "Exception class: ${e.javaClass.name}, message: ${e.message}", e)
            logger.e("DownloadManager", "Failed downloading ${session.mediaId}", e)
            val nextRetry = session.retryCount + 1
            database.downloadSessionDao().incrementRetryCount(session.mediaId, nextRetry, System.currentTimeMillis())
            database.downloadSessionDao().updateSessionState(session.mediaId, DownloadState.PAUSED, System.currentTimeMillis())
            delay(2000L * nextRetry)
            database.downloadSessionDao().updateSessionState(session.mediaId, DownloadState.QUEUED, System.currentTimeMillis())
        }
    }
    
    private suspend fun checkPlaylistReadiness() {
        com.digitalsignage.player.core.performance.PerformanceMonitor.onDbReadTriggered()
        val pendingPlaylist = database.playlistDao().getPlaylistByState(PlaylistState.PENDING)
        if (pendingPlaylist != null) {
            com.digitalsignage.player.core.performance.PerformanceMonitor.onDbReadTriggered()
            val incompleteCount = database.playlistDao().countIncompleteMediaItems(pendingPlaylist.playlistId)
            
            if (incompleteCount == 0) {
                logger.i("DownloadManager", "All media downloaded. Activating playlist: ${pendingPlaylist.playlistId}")
                com.digitalsignage.player.core.performance.PerformanceMonitor.onDbWriteTriggered()
                database.playlistDao().promotePendingToActive(pendingPlaylist.playlistId)
                
                com.digitalsignage.player.core.performance.PerformanceMonitor.onDbReadTriggered()
                val activeItems = database.playlistDao().getMediaItemsForPlaylist(pendingPlaylist.playlistId)
                storageManager.cleanupOrphans(activeItems.map { it.mediaId })
                
                eventBus.publish(PlayerEvent.PlaylistReady)
            }
        }
    }
}

