package com.digitalsignage.player.workers.heartbeat

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.digitalsignage.player.core.event.PlayerEvent
import com.digitalsignage.player.core.event.PlayerEventBus
import com.digitalsignage.player.core.logging.Logger
import com.digitalsignage.player.data.local.datastore.RuntimeConfigStoreImpl
import com.digitalsignage.player.domain.repository.HeartbeatRepository
import com.digitalsignage.player.domain.repository.Result
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Heartbeat strategy:
 *  - PRIMARY: the orchestrator's foreground loop calls [sendHeartbeatNow] every
 *    [heartbeatIntervalSeconds] (backend default 60s; the backend marks a device Offline after 120s).
 *  - FALLBACK: a 15-minute WorkManager periodic job, which is the platform minimum, so the
 *    device still reports occasionally if the app process is asleep.
 */
@Singleton
class HeartbeatManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val configStore: RuntimeConfigStoreImpl,
    private val heartbeatRepository: HeartbeatRepository,
    private val eventBus: PlayerEventBus,
    private val logger: Logger
) {
    companion object {
        const val MIN_INTERVAL_SECONDS = 15L
        const val DEFAULT_INTERVAL_SECONDS = RuntimeConfigStoreImpl.DEFAULT_HEARTBEAT_INTERVAL_SECONDS
        private const val FALLBACK_WORK_INTERVAL_MINUTES = 15L
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val sendMutex = Mutex()
    private var fallbackScheduled = false

    /** Interval in seconds as configured by the backend, clamped to a sane minimum. */
    suspend fun heartbeatIntervalSeconds(): Long {
        val configured = configStore.heartbeatInterval.firstOrNull() ?: DEFAULT_INTERVAL_SECONDS
        return if (configured < MIN_INTERVAL_SECONDS) MIN_INTERVAL_SECONDS else configured
    }

    /** Schedules the WorkManager fallback (idempotent). */
    fun start() {
        if (fallbackScheduled) return
        fallbackScheduled = true
        logger.i("HeartbeatManager", "Scheduling WorkManager fallback heartbeat every $FALLBACK_WORK_INTERVAL_MINUTES minutes")

        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val heartbeatRequest = PeriodicWorkRequestBuilder<HeartbeatWorker>(FALLBACK_WORK_INTERVAL_MINUTES, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            HeartbeatWorker.WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            heartbeatRequest
        )
    }

    /**
     * Sends one heartbeat immediately if a device id exists. Publishes the outcome on the event bus
     * so the orchestrator can re-register on 401/404.
     */
    suspend fun sendHeartbeatNow(): Boolean {
        val deviceId = configStore.deviceId.firstOrNull()
        if (deviceId.isNullOrBlank()) {
            logger.d("HeartbeatManager", "No device id yet; skipping heartbeat")
            return false
        }
        if (!sendMutex.tryLock()) {
            logger.d("HeartbeatManager", "Heartbeat already in flight; skipping")
            return false
        }
        return try {
            when (val result = heartbeatRepository.sendHeartbeat()) {
                is Result.Success -> {
                    eventBus.publish(PlayerEvent.HeartbeatSucceeded)
                    true
                }
                is Result.Error -> {
                    logger.w("HeartbeatManager", "Heartbeat failed: ${result.exception.message}")
                    eventBus.publish(PlayerEvent.HeartbeatFailed(result.exception))
                    false
                }
            }
        } catch (e: Exception) {
            logger.w("HeartbeatManager", "Heartbeat threw: ${e.message}")
            false
        } finally {
            sendMutex.unlock()
        }
    }

    /** Fire-and-forget variant for non-suspending call sites. */
    fun triggerImmediateHeartbeat() {
        scope.launch { sendHeartbeatNow() }
    }

    fun stop() {
        logger.i("HeartbeatManager", "Cancelling fallback heartbeat schedule.")
        fallbackScheduled = false
        WorkManager.getInstance(context).cancelUniqueWork(HeartbeatWorker.WORK_NAME)
    }
}
