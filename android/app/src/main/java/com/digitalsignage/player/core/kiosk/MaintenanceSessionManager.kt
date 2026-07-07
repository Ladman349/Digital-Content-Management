package com.digitalsignage.player.core.kiosk

import com.digitalsignage.player.core.event.PlayerEvent
import com.digitalsignage.player.core.event.PlayerEventBus
import com.digitalsignage.player.core.logging.Logger
import com.digitalsignage.player.data.local.datastore.RuntimeConfigStoreImpl
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MaintenanceSessionManager @Inject constructor(
    private val dataStore: RuntimeConfigStoreImpl,
    private val eventBus: PlayerEventBus,
    private val logger: Logger
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var timeoutJob: Job? = null
    
    private var isSessionActive = false

    fun startSession() {
        isSessionActive = true
        eventBus.publish(PlayerEvent.MaintenanceStarted)
        resetTimeout()
    }

    fun endSession() {
        if (!isSessionActive) return
        isSessionActive = false
        eventBus.publish(PlayerEvent.MaintenanceEnded)
        timeoutJob?.cancel()
    }

    fun onUserInteraction() {
        if (isSessionActive) {
            resetTimeout()
        }
    }

    private fun resetTimeout() {
        timeoutJob?.cancel()
        timeoutJob = scope.launch {
            val timeoutMs = dataStore.maintenanceTimeoutMs.first()
            delay(timeoutMs)
            logger.i("MaintenanceSession", "Inactivity timeout reached. Automatically ending maintenance session.")
            endSession()
        }
    }
}
