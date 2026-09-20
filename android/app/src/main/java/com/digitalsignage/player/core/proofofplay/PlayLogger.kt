package com.digitalsignage.player.core.proofofplay

import com.digitalsignage.player.core.logging.Logger
import com.digitalsignage.player.data.local.datastore.RuntimeConfigStoreImpl
import com.digitalsignage.player.data.local.playlog.PlayLogDao
import com.digitalsignage.player.data.local.playlog.PlayLogEntity
import com.digitalsignage.player.data.remote.ApiService
import com.digitalsignage.player.data.remote.dto.PlayBatchPayload
import com.digitalsignage.player.data.remote.dto.PlayEventDto
import com.digitalsignage.player.di.ApplicationScope
import com.digitalsignage.player.domain.playback.PlayRecorder
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Proof of play. Every item shown is queued on disk by [record] and delivered by [flush], so a
 * screen that is offline for days still reports everything once it is back.
 *
 * Nothing here may ever disturb playback: recording is fire-and-forget off the main thread, every
 * failure is swallowed and logged, and the queue is capped so a screen that can never reach the
 * server does not fill its storage.
 */
@Singleton
class PlayLogger @Inject constructor(
    private val dao: PlayLogDao,
    private val apiService: ApiService,
    private val configStore: RuntimeConfigStoreImpl,
    @ApplicationScope private val applicationScope: CoroutineScope,
    private val logger: Logger
) : PlayRecorder {
    private companion object {
        const val TAG = "PlayLogger"
        /** The server accepts 500 events a batch; stay well inside it. */
        const val BATCH_SIZE = 200
        const val MAX_BATCHES_PER_FLUSH = 10
        /** About six days of ten-second items. Beyond this the oldest plays are dropped. */
        const val MAX_QUEUED = 50_000
        const val PRUNE_CHUNK = 1_000
        const val PRUNE_CHECK_EVERY = 200
        const val MIN_FLUSH_INTERVAL_MS = 5 * 60 * 1000L
        /** Plays shorter than this are a skipped or unsupported item, not something that was shown. */
        const val MIN_RECORDED_MS = 500L
    }

    private val flushMutex = Mutex()
    private var recordedSincePrune = 0
    @Volatile private var lastFlushAt = 0L

    /** Queues one play. Safe to call from the main thread; returns immediately. */
    override fun record(mediaId: String, playlistId: String?, startedAt: Long, durationMs: Long, completed: Boolean) {
        if (durationMs < MIN_RECORDED_MS) return
        applicationScope.launch(Dispatchers.IO) {
            try {
                dao.insert(PlayLogEntity(mediaId = mediaId, playlistId = playlistId, startedAt = startedAt, durationMs = durationMs, completed = completed))
                if (++recordedSincePrune >= PRUNE_CHECK_EVERY) {
                    recordedSincePrune = 0
                    val excess = dao.count() - MAX_QUEUED
                    if (excess > 0) {
                        logger.w(TAG, "Play queue is full; dropping the oldest ${excess + PRUNE_CHUNK} entries")
                        dao.deleteOldest(excess + PRUNE_CHUNK)
                    }
                }
            } catch (e: Exception) {
                logger.w(TAG, "Could not queue play of $mediaId: ${e.message}")
            }
        }
    }

    /** Called from the heartbeat loop. Sends at most every [MIN_FLUSH_INTERVAL_MS]. */
    suspend fun flushIfDue() {
        if (System.currentTimeMillis() - lastFlushAt < MIN_FLUSH_INTERVAL_MS) return
        flush()
    }

    /** Delivers queued plays, oldest first. Stops quietly at the first failure and retries next time. */
    suspend fun flush() {
        if (!flushMutex.tryLock()) return
        try {
            val deviceId = configStore.deviceId.firstOrNull()
            if (deviceId.isNullOrBlank()) return
            lastFlushAt = System.currentTimeMillis()

            repeat(MAX_BATCHES_PER_FLUSH) {
                // A batch that was attempted before goes first, unchanged, under its original id.
                var batchId = dao.oldestPendingBatchId()
                if (batchId == null) {
                    batchId = UUID.randomUUID().toString()
                    if (dao.claimOldest(batchId, BATCH_SIZE) == 0) return
                }
                val entries = dao.entriesInBatch(batchId)
                if (entries.isEmpty()) return

                val payload = PlayBatchPayload(
                    batchId = batchId,
                    sentAt = System.currentTimeMillis(),
                    events = entries.map { PlayEventDto(it.mediaId, it.playlistId, it.startedAt, it.durationMs, it.completed) }
                )
                val response = apiService.postPlays(deviceId, payload)
                when {
                    response.isSuccessful -> dao.deleteBatch(batchId)
                    // The server understood the batch and will never accept it. Keeping it would block
                    // everything queued behind it. Anything else (offline, 5xx, a 404 while the
                    // device re-registers) is temporary: the batch stays and is sent again.
                    response.code() == 422 || response.code() == 400 -> {
                        logger.w(TAG, "Server refused batch $batchId (${response.code()}); discarding ${entries.size} plays")
                        dao.deleteBatch(batchId)
                    }
                    else -> {
                        logger.d(TAG, "Play upload deferred: HTTP ${response.code()}")
                        return
                    }
                }
            }
        } catch (e: Exception) {
            logger.d(TAG, "Play upload deferred: ${e.message}")
        } finally {
            flushMutex.unlock()
        }
    }
}
