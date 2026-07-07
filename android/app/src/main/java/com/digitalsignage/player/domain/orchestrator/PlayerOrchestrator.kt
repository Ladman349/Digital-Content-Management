package com.digitalsignage.player.domain.orchestrator

import com.digitalsignage.player.core.event.PlayerEvent
import com.digitalsignage.player.core.event.PlayerEventBus
import com.digitalsignage.player.core.logging.Logger
import com.digitalsignage.player.core.network.NetworkMonitor
import com.digitalsignage.player.data.repository.DeviceRepositoryImpl
import com.digitalsignage.player.domain.repository.PlaylistRepository
import com.digitalsignage.player.domain.state.PlayerState
import com.digitalsignage.player.domain.state.PlayerStateMachine
import com.digitalsignage.player.core.error.AppError
import com.digitalsignage.player.domain.repository.Result
import com.digitalsignage.player.core.kiosk.KioskManager
import com.digitalsignage.player.core.kiosk.MaintenanceSessionManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject
import java.util.concurrent.TimeUnit
import javax.inject.Singleton
import android.app.Activity
import kotlinx.coroutines.isActive
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

interface PlayerOrchestrator {
    fun initialize()
    fun attachActivity(activity: Activity)
    fun detachActivity()
    fun onUserInteraction()
    fun requestMaintenance()
    fun onMaintenanceAuthorized()
}

@Singleton
class PlayerOrchestratorImpl @Inject constructor(
    @dagger.hilt.android.qualifiers.ApplicationContext private val context: android.content.Context,
    @com.digitalsignage.player.di.ApplicationScope private val applicationScope: CoroutineScope,
    private val stateMachine: PlayerStateMachine,
    private val eventBus: PlayerEventBus,
    private val logger: Logger,
    private val deviceRepository: DeviceRepositoryImpl,
    private val playlistRepository: PlaylistRepository,
    private val networkMonitor: NetworkMonitor,
    private val downloadManager: com.digitalsignage.player.workers.download.DownloadManager,
    private val playlistExecutor: com.digitalsignage.player.domain.playback.PlaylistExecutor,
    private val heartbeatManager: com.digitalsignage.player.workers.heartbeat.HeartbeatManager,
    private val startupValidator: com.digitalsignage.player.core.recovery.StartupValidator,
    private val crashRecoveryManager: com.digitalsignage.player.core.recovery.CrashRecoveryManager,
    private val kioskManager: KioskManager,
    private val maintenanceSessionManager: MaintenanceSessionManager
) : PlayerOrchestrator {

    private val initializationMutex = Mutex()
    private var isInitialized = false

    private var syncJob: Job? = null
    private var currentActivity: Activity? = null

    private val syncMutex = Mutex()
    private var pollingJob: Job? = null

    override fun initialize() {
        android.util.Log.i("InvestigateReg", "2. PlayerOrchestrator.initialize() entered")
        android.util.Log.i("StartupTrace", "Trace: PlayerOrchestrator.initialize() started")
        applicationScope.launch {
            android.util.Log.i("StartupTrace", "Trace: PlayerOrchestrator launch started")
            initializationMutex.withLock {
                android.util.Log.i(
                    "StartupTrace",
                    "Trace: PlayerOrchestrator mutex lock acquired, isInitialized=$isInitialized"
                )
                if (isInitialized) {
                    android.util.Log.i(
                        "StartupTrace",
                        "Trace: PlayerOrchestrator early return (isInitialized = true)"
                    )
                    return@launch
                }
                isInitialized = true

                logger.i("PlayerFlow", "[TRANSITION] BOOTING")

                crashRecoveryManager.initialize()

                observeStateTransitions()
                observeEvents()
                observePlaylistChanges()

                logger.i("PlayerFlow", "[TRANSITION] VALIDATING")
                android.util.Log.i(
                    "StartupTrace",
                    "Trace: PlayerOrchestrator calling startupValidator.validateAndRecover()"
                )
                try {
                    startupValidator.validateAndRecover()
                    logger.i("Orchestrator", "Startup validation completed")
                    android.util.Log.i(
                        "StartupTrace",
                        "Trace: PlayerOrchestrator validation completed, validating credentials"
                    )

                    if (deviceRepository.validateLocalCredentials()) {
                        logger.i("PlayerFlow", "[TRANSITION] REGISTERED")
                        android.util.Log.i(
                            "StartupTrace",
                            "Trace: PlayerOrchestrator calling executeCommand(SyncPlaylist)"
                        )
                        stateMachine.transitionTo(PlayerState.SYNCING)
                        executeCommand(PlayerCommand.SyncPlaylist)
                        heartbeatManager.start()
                        startPolling()
                    } else {
                        logger.i("PlayerFlow", "[TRANSITION] REGISTERING")
                        android.util.Log.i(
                            "StartupTrace",
                            "Trace: PlayerOrchestrator calling executeCommand(RegisterDevice)"
                        )
                        stateMachine.transitionTo(PlayerState.REGISTERING)
                        executeCommand(PlayerCommand.RegisterDevice)
                    }
                } catch (e: Exception) {
                    logger.e("PlayerFlow", "[TRANSITION] ERROR - Startup validation failed", e)
                    // Continue with whatever state we can
                    if (deviceRepository.validateLocalCredentials()) {
                        stateMachine.transitionTo(PlayerState.SYNCING)
                        executeCommand(PlayerCommand.SyncPlaylist)
                        heartbeatManager.start()
                        startPolling()
                    } else {
                        stateMachine.transitionTo(PlayerState.REGISTERING)
                        executeCommand(PlayerCommand.RegisterDevice)
                    }
                }
            }
        }
    }

    private fun observeEvents() {
        applicationScope.launch {
            eventBus.events.collect { event ->
                when (event) {
                    is PlayerEvent.MaintenanceStarted -> {
                        if (currentActivity != null) {
                            kioskManager.enterMaintenanceMode(currentActivity!!)
                        }
                    }

                    is PlayerEvent.MaintenanceEnded -> {
                        if (currentActivity != null) {
                            kioskManager.exitMaintenanceMode(currentActivity!!)
                        }
                    }

                    is PlayerEvent.RegistrationSucceeded -> {
                        logger.i("PlayerFlow", "[TRANSITION] REGISTERED")
                        stateMachine.transitionTo(PlayerState.SYNCING)
                        executeCommand(PlayerCommand.SyncPlaylist)
                        heartbeatManager.start()
                        startPolling()
                    }

                    is PlayerEvent.PlaylistUpdated -> {
                        logger.i("PlayerFlow", "[TRANSITION] PLAYLIST_RECEIVED")
                        eventBus.publish(PlayerEvent.DebugStage("2. PlaylistUpdated emitted (Orchestrator received it)"))
                        downloadManager.startProcessing()
                        stateMachine.transitionTo(PlayerState.DOWNLOADING)
                        // Note: DownloadMedia is implicit via downloadManager.startProcessing()
                    }

                    is PlayerEvent.DownloadStarted -> {
                        logger.i(
                            "PlayerFlow",
                            "[TRANSITION] DOWNLOAD_STARTED - Media: ${event.mediaId}"
                        )
                    }

                    is PlayerEvent.PlaylistReady -> {
                        android.util.Log.i("PlaylistTrace", "PlaylistReady received")
                        eventBus.publish(PlayerEvent.DebugStage("7. PlayerOrchestrator processed PlaylistReady, issuing StartPlayback"))
                        android.util.Log.i(
                            "ReadinessTrace",
                            "Orchestrator received PlaylistReady event"
                        )
                        logger.i("PlayerFlow", "[TRANSITION] DOWNLOAD_COMPLETED")
                        logger.i("PlayerFlow", "[TRANSITION] PLAYLIST_ACTIVATED")
                        stateMachine.transitionTo(PlayerState.READY)
                        if (stateMachine.targetState.value == PlayerState.PLAYING) {
                            stateMachine.transitionTo(PlayerState.PLAYING)
                            executeCommand(PlayerCommand.StartPlayback)
                        }
                    }

                    is PlayerEvent.PlaybackStarted -> {
                        logger.i(
                            "PlayerFlow",
                            "[TRANSITION] PLAYBACK_STARTED - Media: ${event.mediaId}"
                        )
                    }

                    is PlayerEvent.HeartbeatStarted -> {
                        logger.i("PlayerFlow", "[TRANSITION] HEARTBEAT_STARTED")
                    }

                    is PlayerEvent.HeartbeatFailed -> {
                        eventBus.publish(PlayerEvent.DebugStage("HeartbeatFailed handler entered. Error type: ${event.error::class.java.name}, msg: ${event.error.message}"))
                        if (event.error is AppError.Recoverable) {
                            logger.w(
                                "PlayerFlow",
                                "Recoverable error during heartbeat (likely 401/404). Re-registering."
                            )
                            eventBus.publish(PlayerEvent.DebugStage("CLEAR_REGISTRATION_FROM_HEARTBEAT"))
                            deviceRepository.clearRegistration()
                            stopPolling()
                            stateMachine.transitionTo(PlayerState.REGISTERING)
                            executeCommand(PlayerCommand.RegisterDevice)
                        }
                    }

                    else -> {}
                }
            }
        }
    }

    private fun observePlaylistChanges() {
        applicationScope.launch {
            playlistRepository.observeCurrentPlaylist().collect { playlist ->
                if (playlist != null) {
                    android.util.Log.i("PlaylistTrace", "ORCHESTRATOR RECEIVED PLAYLIST version=${playlist.version}")
                    if (stateMachine.currentState.value == PlayerState.PLAYING) {
                        playlistExecutor.execute(playlist)
                    } else {
                        android.util.Log.i("PlaylistTrace", "Orchestrator ignored emit because state is ${stateMachine.currentState.value.name}")
                    }
                }
            }
        }
    }

    private fun observeStateTransitions() {
        applicationScope.launch {
            stateMachine.currentState.collect { state ->
                eventBus.publish(PlayerEvent.DebugStage("--- TRANSITION: ${state.name} ---"))
            }
        }
    }

    private fun executeCommand(command: PlayerCommand) {
        android.util.Log.i(
            "StartupTrace",
            "Trace: PlayerOrchestrator.executeCommand() called with command: $command"
        )
        when (command) {
            is PlayerCommand.RegisterDevice -> {
                android.util.Log.i("InvestigateReg", "3. executeCommand(RegisterDevice) entered")
                val exceptionHandler =
                    kotlinx.coroutines.CoroutineExceptionHandler { _, throwable ->
                        android.util.Log.e(
                            "InvestigateReg",
                            "8. Global Coroutine Exception Handler caught error in RegisterDevice",
                            throwable
                        )
                    }
                applicationScope.launch(exceptionHandler) {
                    try {
                        logger.i("PlayerFlow", "[TRANSITION] REGISTERING")
                        android.util.Log.i(
                            "InvestigateReg",
                            "Calling deviceRepository.registerDevice()"
                        )
                        val result = deviceRepository.registerDevice()
                        android.util.Log.i(
                            "InvestigateReg",
                            "Returned from deviceRepository.registerDevice() with result: $result"
                        )
                        if (result is Result.Success) {
                            logger.i("PlayerFlow", "[TRANSITION] REGISTERED")
                            eventBus.publish(PlayerEvent.RegistrationSucceeded)
                        } else if (result is Result.Error) {
                            logger.e(
                                "PlayerFlow",
                                "[TRANSITION] ERROR - Registration failed",
                                result.exception
                            )
                            stateMachine.transitionToError(result.exception as AppError)
                            if (result.exception is AppError.DebugException) {
                                val debugExc = result.exception as AppError.DebugException
                                eventBus.publish(
                                    PlayerEvent.StartupException(
                                        state = stateMachine.currentState.value.name,
                                        command = "RegisterDevice",
                                        exceptionClass = debugExc.exceptionClass,
                                        exceptionMessage = debugExc.exceptionMessage,
                                        stackTrace = debugExc.stackTrace,
                                        cause = debugExc.causeMessage
                                    )
                                )
                            } else if (result.exception is AppError.Retryable) {
                                delay(5000)
                                executeCommand(PlayerCommand.RegisterDevice)
                            }
                        }
                    } catch (e: Exception) {
                        android.util.Log.e(
                            "InvestigateReg",
                            "7. Catch block inside executeCommand(RegisterDevice)",
                            e
                        )
                    }
                }
            }

            is PlayerCommand.SyncPlaylist -> {
                android.util.Log.i(
                    "StartupTrace",
                    "Trace: PlayerOrchestrator executing SyncPlaylist"
                )
                if (syncJob?.isActive == true) {
                    return
                }
                syncJob = applicationScope.launch {
                    attemptSync()
                }
            }

            is PlayerCommand.StartPlayback -> {
                android.util.Log.i("PlaylistTrace", "StartPlayback called")
                logger.i("Orchestrator", "Executing StartPlayback")
                android.util.Log.i("ReadinessTrace", "Orchestrator executing StartPlayback command")
                applicationScope.launch {
                    if (currentActivity != null) {
                        kioskManager.enableKiosk(currentActivity!!)
                        eventBus.publish(PlayerEvent.KioskStateChanged(kioskManager.isKioskActive()))
                    }
                    android.util.Log.i(
                        "ReadinessTrace",
                        "StartPlayback: Observing current playlist..."
                    )
                    playlistRepository.observeCurrentPlaylist().first { it != null }
                        ?.let { activePlaylist ->
                            android.util.Log.i(
                                "ReadinessTrace",
                                "StartPlayback: Active playlist found (${activePlaylist.playlistId}). Calling executor..."
                            )
                            playlistExecutor.execute(activePlaylist)
                        } ?: run {
                        android.util.Log.i(
                            "ReadinessTrace",
                            "StartPlayback: Condition failed - active playlist is null"
                        )
                    }
                }
            }

            else -> {}
        }
    }

    private companion object {
        const val PLAYLIST_POLL_INTERVAL_MS = 15_000L
    }

    private suspend fun attemptSyncSafely() {
        if (!syncMutex.tryLock()) {
            android.util.Log.d("SyncTrace", "Sync already in progress, skipping")
            return
        }

        try {
            android.util.Log.i("SyncTrace", "Periodic sync started")
            attemptSync()
            android.util.Log.i("SyncTrace", "Periodic sync completed")
        } catch (e: Exception) {
            android.util.Log.e("SyncTrace", "Periodic sync failed", e)
        } finally {
            syncMutex.unlock()
        }
    }

    private fun startPolling() {
        if (pollingJob?.isActive == true) return
        pollingJob = applicationScope.launch {
            while (isActive) {
                val currentState = stateMachine.currentState.value
                val isSyncable = when (currentState) {
                    PlayerState.BOOTING,
                    PlayerState.REGISTERING,
                    PlayerState.SYNCING,
                    PlayerState.ERROR -> false
                    else -> true
                }
                if (isSyncable) {
                    android.util.Log.i("SyncTrace", "Periodic sync polling triggered in state ${currentState.name}")
                    attemptSyncSafely()
                }
                delay(PLAYLIST_POLL_INTERVAL_MS)
            }
        }
    }

    private fun stopPolling() {
        pollingJob?.cancel()
        pollingJob = null
    }

    private suspend fun attemptSync() {
        android.util.Log.i("StartupTrace", "Trace: PlayerOrchestrator.attemptSync() started")
        logger.i("PlayerFlow", "[TRANSITION] SYNCING")
        if (networkMonitor.isOnline.first() == false) {
            android.util.Log.i(
                "StartupTrace",
                "Trace: PlayerOrchestrator.attemptSync() early return (Offline)"
            )
            logger.w("Orchestrator", "Offline. Sync paused.")
            return
        }

        android.util.Log.i(
            "StartupTrace",
            "Trace: PlayerOrchestrator.attemptSync() calling playlistRepository.syncPlaylist()"
        )
        val result = playlistRepository.syncPlaylist()
        if (result is Result.Success) {
            eventBus.publish(PlayerEvent.DebugStage("attemptSync received Result.Success"))
        } else if (result is Result.Error) {
            eventBus.publish(PlayerEvent.DebugStage("attemptSync received Result.Error. Type: ${result.exception::class.java.name}"))
        }
        when (result) {
            is Result.Success -> {
                eventBus.publish(PlayerEvent.DebugStage("1. PlaylistRepository parsed 200 OK successfully"))
                val wasUpdated = result.data
                if (wasUpdated) {
                    eventBus.publish(PlayerEvent.PlaylistUpdated)
                } else {
                    // Not modified, ready for playback
                    eventBus.publish(PlayerEvent.PlaylistReady)
                }
            }

            is Result.Error -> {
                if (result.exception is AppError.Recoverable) {
                    logger.w(
                        "PlayerFlow",
                        "Recoverable error during sync (likely 401/404). Re-registering."
                    )
                    eventBus.publish(PlayerEvent.DebugStage("CLEAR_REGISTRATION_FROM_SYNC"))
                    deviceRepository.clearRegistration()
                    stopPolling()
                    stateMachine.transitionTo(PlayerState.REGISTERING)
                    executeCommand(PlayerCommand.RegisterDevice)
                } else if (result.exception is AppError.Retryable) {
                    delay(5000)
                    attemptSync() // Basic retry for sync
                } else {
                    stopPolling()
                    stateMachine.transitionToError(result.exception as AppError)
                }
            }
        }
    }

    override fun attachActivity(activity: Activity) {
        currentActivity = activity
        if (stateMachine.currentState.value == PlayerState.READY || stateMachine.currentState.value == PlayerState.PLAYING) {
            kioskManager.enableKiosk(activity)
            eventBus.publish(PlayerEvent.KioskStateChanged(kioskManager.isKioskActive()))
        }
    }

    override fun detachActivity() {
        if (currentActivity != null) {
            kioskManager.disableKiosk(currentActivity!!)
            currentActivity = null
        }
    }

    override fun onUserInteraction() {
        maintenanceSessionManager.onUserInteraction()
    }

    override fun requestMaintenance() {
        val activity = currentActivity
        if (activity != null) {
            eventBus.publish(PlayerEvent.MaintenanceRequested)
        } else {
            logger.w("PlayerOrchestrator", "Cannot start maintenance: No active UI")
        }
    }

    override fun onMaintenanceAuthorized() {
        maintenanceSessionManager.startSession()
    }
}






