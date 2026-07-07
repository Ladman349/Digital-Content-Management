package com.digitalsignage.player.workers.heartbeat

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.digitalsignage.player.core.logging.Logger
import com.digitalsignage.player.data.local.datastore.RuntimeConfigStoreImpl
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancelChildren
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class HeartbeatManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val configStore: RuntimeConfigStoreImpl,
    private val logger: Logger
) {
    // Injectable scopes are preferred, but a managed SupervisorJob internally ensures we do not leak
    // without polluting Hilt graphs for this specific subsystem.
    private val managerJob = SupervisorJob()
    private val scope = CoroutineScope(Dispatchers.Main + managerJob)
    private var collectionJob: Job? = null

    fun start() {
        if (collectionJob?.isActive == true) {
            logger.i("HeartbeatManager", "Already started. Ignoring duplicate start request.")
            return
        }
        
        logger.i("HeartbeatManager", "Starting heartbeat manager configuration collector.")
        collectionJob = scope.launch {
            configStore.heartbeatInterval.distinctUntilChanged().collect { configuredInterval ->
                var intervalMinutes = configuredInterval
                
                if (intervalMinutes < 15L) {
                    logger.w("HeartbeatManager", "Configured interval ${intervalMinutes}m is below WorkManager minimum. Clamping to 15m.")
                    intervalMinutes = 15L
                }
                
                scheduleHeartbeat(intervalMinutes)
            }
        }
    }

    /**
     * Schedules the worker.
     * Note: PeriodicWorkRequest has a hard minimum scheduling interval of 15 minutes enforced by Android.
     * If business requirements ever dictate heartbeats faster than 15 minutes, this implementation
     * must be replaced with Foreground Services, AlarmManager, or a persistent WebSocket connection.
     */
    private fun scheduleHeartbeat(intervalMinutes: Long) {
        logger.i("HeartbeatManager", "Scheduling heartbeat with interval $intervalMinutes minutes")
        
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()
            
        val heartbeatRequest = PeriodicWorkRequestBuilder<HeartbeatWorker>(intervalMinutes, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .build()
            
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            HeartbeatWorker.WORK_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,
            heartbeatRequest
        )
    }

    fun stop() {
        logger.i("HeartbeatManager", "Cancelling heartbeat schedule and stopping collector.")
        
        // Cancel active collection job to prevent leaks
        collectionJob?.cancel()
        collectionJob = null
        
        WorkManager.getInstance(context).cancelUniqueWork(HeartbeatWorker.WORK_NAME)
    }
}

