package com.digitalsignage.player.workers.heartbeat

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.digitalsignage.player.core.event.PlayerEvent
import com.digitalsignage.player.core.event.PlayerEventBus
import com.digitalsignage.player.core.logging.Logger
import com.digitalsignage.player.domain.repository.HeartbeatRepository
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@HiltWorker
class HeartbeatWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted workerParams: WorkerParameters,
    private val heartbeatRepository: HeartbeatRepository,
    private val eventBus: PlayerEventBus,
    private val logger: Logger
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        logger.i("HeartbeatWorker", "Starting scheduled heartbeat execution.")
        eventBus.publish(PlayerEvent.HeartbeatStarted)
        
        when (val result = heartbeatRepository.sendHeartbeat()) {
            is com.digitalsignage.player.domain.repository.Result.Success -> {
                logger.i("HeartbeatWorker", "Heartbeat succeeded.")
                eventBus.publish(PlayerEvent.HeartbeatSucceeded)
                Result.success()
            }
            is com.digitalsignage.player.domain.repository.Result.Error -> {
                logger.e("HeartbeatWorker", "Heartbeat failed", result.exception)
                eventBus.publish(PlayerEvent.HeartbeatFailed(result.exception))
                // If offline, retry based on WorkManager backoff policy
                Result.failure() // Snapshot policy: do not replay missed history
            }
        }
    }

    companion object {
        const val WORK_NAME = "HeartbeatWorker"
    }
}
