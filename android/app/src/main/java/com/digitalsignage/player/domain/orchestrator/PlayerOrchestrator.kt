package com.digitalsignage.player.domain.orchestrator

import android.app.Activity
import com.digitalsignage.player.core.error.AppError
import com.digitalsignage.player.core.event.PlayerEvent
import com.digitalsignage.player.core.event.PlayerEventBus
import com.digitalsignage.player.core.kiosk.KioskManager
import com.digitalsignage.player.core.kiosk.MaintenanceSessionManager
import com.digitalsignage.player.core.logging.Logger
import com.digitalsignage.player.core.network.NetworkMonitor
import com.digitalsignage.player.data.repository.DeviceRepositoryImpl
import com.digitalsignage.player.domain.repository.PlaylistRepository
import com.digitalsignage.player.domain.repository.Result
import com.digitalsignage.player.domain.state.PlayerState
import com.digitalsignage.player.domain.state.PlayerStateMachine
import com.digitalsignage.player.presentation.PlaybackStateStore
import com.digitalsignage.player.presentation.PresentationState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.random.Random

interface PlayerOrchestrator {
    fun initialize()
    fun attachActivity(activity: Activity)
    fun detachActivity(activity: Activity)
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
    private val maintenanceSessionManager: MaintenanceSessionManager,
    private val playbackStateStore: PlaybackStateStore
) : PlayerOrchestrator {

    private companion object {
        const val PLAYLIST_POLL_INTERVAL_MS = 30_000L
        const val RETRY_BASE_MS = 5_000L
        val RETRY_CAP_MS = TimeUnit.MINUTES.toMillis(5)
    }

    private val initializationMutex = Mutex()
    private var isInitialized = false

    /** Serialises every playlist sync (start-up, registration, polling and manual). */
    private val syncMutex = Mutex()

    /** Guarantees a single in-flight registration. */
    private val registrationMutex = Mutex()

    private var syncJob: Job? = null
    private var registrationJob: Job? = null
    private var pollingJob: Job? = null
    private var heartbeatJob: Job? = null

    @Volatile
    private var currentActivity: Activity? = null

    // Download progress snapshot used for the status screen.
    private var downloadsCompleted = 0
    private var downloadsTotal = 0
    private var currentItemPercent = 0

    @Volatile
    private var isOnline = true

    override fun initialize() {
        logger.i("StartupTrace", "PlayerOrchestrator.initialize() called")
        applicationScope.launch {
            initializationMutex.withLock {
                if (isInitialized) {
                    logger.i("StartupTrace", "PlayerOrchestrator already initialised; ignoring")
                    return@launch
                }
                isInitialized = true

                logger.i("PlayerFlow", "[TRANSITION] BOOTING")
                publishStatus()

                crashRecoveryManager.initialize()

                observeStateTransitions()
                observeNetwork()
                observeEvents()
                observePlaylistChanges()
                startHeartbeatLoop()

                logger.i("PlayerFlow", "[TRANSITION] VALIDATING")
                try {
                    startupValidator.validateAndRecover()
                    logger.i("Orchestrator", "Startup validation completed")
                } catch (e: Exception) {
                    logger.e("PlayerFlow", "[TRANSITION] ERROR - Startup validation failed", e)
                    // Continue with whatever state we can.
                }

                if (deviceRepository.validateLocalCredentials()) {
                    logger.i("PlayerFlow", "[TRANSITION] REGISTERED")
                    stateMachine.transitionTo(PlayerState.SYNCING)
                    executeCommand(PlayerCommand.SyncPlaylist)
                    heartbeatManager.start()
                    startPolling()
                } else {
                    logger.i("PlayerFlow", "[TRANSITION] REGISTERING")
                    stateMachine.transitionTo(PlayerState.REGISTERING)
                    executeCommand(PlayerCommand.RegisterDevice)
                }
            }
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Observers
    // ---------------------------------------------------------------------------------------------

    private fun observeEvents() {
        applicationScope.launch {
            eventBus.events.collect { event ->
                when (event) {
                    is PlayerEvent.MaintenanceStarted -> currentActivity?.let { kioskManager.enterMaintenanceMode(it) }

                    is PlayerEvent.MaintenanceEnded -> currentActivity?.let { kioskManager.exitMaintenanceMode(it) }

                    is PlayerEvent.RegistrationSucceeded -> {
                        logger.i("PlayerFlow", "[TRANSITION] REGISTERED")
                        stateMachine.transitionTo(PlayerState.SYNCING)
                        executeCommand(PlayerCommand.SyncPlaylist)
                        heartbeatManager.start()
                        startPolling()
                    }

                    is PlayerEvent.PlaylistUpdated -> {
                        logger.i("PlayerFlow", "[TRANSITION] PLAYLIST_RECEIVED")
                        downloadsCompleted = 0
                        downloadsTotal = 0
                        currentItemPercent = 0
                        downloadManager.startProcessing()
                        stateMachine.transitionTo(PlayerState.DOWNLOADING)
                    }

                    is PlayerEvent.DownloadStarted -> {
                        currentItemPercent = 0
                        logger.i("PlayerFlow", "[TRANSITION] DOWNLOAD_STARTED - Media: ${event.mediaId}")
                    }

                    is PlayerEvent.DownloadQueueProgress -> {
                        downloadsCompleted = event.completed
                        downloadsTotal = event.total
                        currentItemPercent = 0
                        publishStatus()
                    }

                    is PlayerEvent.DownloadProgress -> {
                        currentItemPercent = event.progress.coerceIn(0, 100)
                        publishStatus()
                    }

                    is PlayerEvent.DownloadCompleted -> {
                        currentItemPercent = 0
                    }

                    is PlayerEvent.PlaylistReady -> {
                        logger.i("PlayerFlow", "[TRANSITION] DOWNLOAD_COMPLETED / PLAYLIST_ACTIVATED")
                        stateMachine.transitionTo(PlayerState.READY)
                        if (stateMachine.targetState.value == PlayerState.PLAYING) {
                            stateMachine.transitionTo(PlayerState.PLAYING)
                            executeCommand(PlayerCommand.StartPlayback)
                        }
                    }

                    is PlayerEvent.PlaybackStarted -> {
                        logger.i("PlayerFlow", "[TRANSITION] PLAYBACK_STARTED - Media: ${event.mediaId}")
                    }

                    is PlayerEvent.HeartbeatFailed -> {
                        if (event.error is AppError.Recoverable &&
                            stateMachine.currentState.value != PlayerState.REGISTERING
                        ) {
                            logger.w("PlayerFlow", "Recoverable error during heartbeat (401/404). Re-registering.")
                            reRegister()
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
                if (stateMachine.currentState.value != PlayerState.PLAYING) return@collect
                if (playlist != null) {
                    playlistExecutor.execute(playlist)
                } else {
                    playlistExecutor.stop()
                }
            }
        }
    }

    private fun observeStateTransitions() {
        applicationScope.launch {
            stateMachine.currentState.collect { state ->
                logger.i("PlayerFlow", "--- STATE: ${state.name} ---")
                publishStatus()
            }
        }
    }

    private fun observeNetwork() {
        applicationScope.launch {
            networkMonitor.isOnline.collect { online ->
                val wasOnline = isOnline
                isOnline = online
                if (online && !wasOnline) {
                    logger.i("PlayerFlow", "Network restored")
                    eventBus.publish(PlayerEvent.NetworkRestored())
                    val state = stateMachine.currentState.value
                    if (state == PlayerState.OFFLINE) {
                        stateMachine.transitionTo(PlayerState.SYNCING)
                    }
                    if (state != PlayerState.REGISTERING && state != PlayerState.BOOTING) {
                        executeCommand(PlayerCommand.SyncPlaylist)
                    }
                } else if (!online && wasOnline) {
                    logger.w("PlayerFlow", "Network lost")
                    eventBus.publish(PlayerEvent.NetworkLost())
                }
                publishStatus()
            }
        }
    }

    /** Maps the machine state + network + download progress into a status for the screen. */
    private fun publishStatus() {
        val state = stateMachine.currentState.value
        val status: PresentationState = when {
            state == PlayerState.ERROR -> {
                val err = stateMachine.currentError.value
                PresentationState.Error(err?.messageStr ?: "Unknown error")
            }
            !isOnline -> PresentationState.Offline
            else -> when (state) {
                PlayerState.BOOTING, PlayerState.RECOVERING -> PresentationState.Booting
                PlayerState.REGISTERING -> PresentationState.Registering
                PlayerState.SYNCING -> PresentationState.Syncing
                PlayerState.DOWNLOADING -> {
                    val total = downloadsTotal
                    val completed = downloadsCompleted.coerceAtMost(total)
                    val percent = if (total <= 0) 0 else {
                        (((completed * 100) + currentItemPercent) / total).coerceIn(0, 100)
                    }
                    PresentationState.Downloading(completed, total, percent)
                }
                PlayerState.OFFLINE -> PresentationState.Offline
                PlayerState.READY, PlayerState.PLAYING -> PresentationState.NoContent
                PlayerState.ERROR -> PresentationState.Error("Unknown error")
            }
        }
        playbackStateStore.updateSystemState(status)
    }

    // ---------------------------------------------------------------------------------------------
    // Commands
    // ---------------------------------------------------------------------------------------------

    private fun executeCommand(command: PlayerCommand) {
        logger.i("StartupTrace", "PlayerOrchestrator.executeCommand($command)")
        when (command) {
            is PlayerCommand.RegisterDevice -> {
                if (registrationJob?.isActive == true) {
                    logger.i("Orchestrator", "Registration already in progress; ignoring duplicate request")
                    return
                }
                registrationJob = applicationScope.launch { registerWithBackoff() }
            }

            is PlayerCommand.SyncPlaylist -> {
                if (syncJob?.isActive == true) {
                    logger.d("SyncTrace", "Sync already scheduled; ignoring")
                    return
                }
                syncJob = applicationScope.launch { syncWithBackoff() }
            }

            is PlayerCommand.StartPlayback -> {
                logger.i("Orchestrator", "Executing StartPlayback")
                applicationScope.launch {
                    currentActivity?.let {
                        kioskManager.enableKiosk(it)
                        eventBus.publish(PlayerEvent.KioskStateChanged(kioskManager.isKioskActive()))
                    }
                    val activePlaylist = playlistRepository.observeCurrentPlaylist().first { it != null }
                    if (activePlaylist != null) {
                        logger.i("Orchestrator", "StartPlayback: active playlist ${activePlaylist.playlistId}")
                        playlistExecutor.execute(activePlaylist)
                    }
                }
            }

            else -> {}
        }
    }

    private fun backoffDelay(attempt: Int): Long {
        val exp = RETRY_BASE_MS * (1L shl attempt.coerceIn(0, 10))
        val capped = exp.coerceAtMost(RETRY_CAP_MS)
        val jitter = (capped * Random.nextDouble(0.0, 0.25)).toLong()
        return capped + jitter
    }

    private suspend fun registerWithBackoff() {
        registrationMutex.withLock {
            var attempt = 0
            while (currentCoroutineIsActive()) {
                logger.i("PlayerFlow", "[TRANSITION] REGISTERING (attempt ${attempt + 1})")
                val result = try {
                    deviceRepository.registerDevice()
                } catch (e: Exception) {
                    Result.Error(AppError.Retryable("Registration threw", e))
                }

                when (result) {
                    is Result.Success -> {
                        logger.i("PlayerFlow", "[TRANSITION] REGISTERED")
                        eventBus.publish(PlayerEvent.RegistrationSucceeded)
                        return
                    }
                    is Result.Error -> {
                        logger.e("PlayerFlow", "[TRANSITION] ERROR - Registration failed", result.exception)
                        publishStartupException("RegisterDevice", result.exception)
                        val error = result.exception
                        val retry = error is AppError.Retryable || error is AppError.DebugException ||
                            error is AppError.Recoverable
                        if (!retry) {
                            stateMachine.transitionToError(error as? AppError ?: AppError.Fatal(error.message ?: "Registration failed"))
                            return
                        }
                        val wait = backoffDelay(attempt)
                        logger.w("PlayerFlow", "Retrying registration in ${wait / 1000}s")
                        attempt++
                        delay(wait)
                    }
                }
            }
        }
    }

    private suspend fun syncWithBackoff() {
        var attempt = 0
        while (currentCoroutineIsActive()) {
            val outcome = syncMutex.withLock { attemptSync() }
            when (outcome) {
                SyncOutcome.DONE, SyncOutcome.OFFLINE, SyncOutcome.ABORTED -> return
                SyncOutcome.RETRY -> {
                    val wait = backoffDelay(attempt)
                    logger.w("PlayerFlow", "Retrying sync in ${wait / 1000}s")
                    attempt++
                    delay(wait)
                }
            }
        }
    }

    private enum class SyncOutcome { DONE, RETRY, OFFLINE, ABORTED }

    private suspend fun attemptSync(): SyncOutcome {
        logger.i("PlayerFlow", "[TRANSITION] SYNCING")
        if (networkMonitor.isOnline.first() == false) {
            logger.w("Orchestrator", "Offline. Sync paused until network returns.")
            if (stateMachine.currentState.value == PlayerState.SYNCING) {
                stateMachine.transitionTo(PlayerState.OFFLINE)
            }
            return SyncOutcome.OFFLINE
        }

        val result = playlistRepository.syncPlaylist()
        return when (result) {
            is Result.Success -> {
                if (result.data) {
                    eventBus.publish(PlayerEvent.PlaylistUpdated)
                } else if (stateMachine.currentState.value != PlayerState.PLAYING) {
                    eventBus.publish(PlayerEvent.PlaylistReady)
                } else {
                    logger.i("Orchestrator", "Sync: no updates, playback already active.")
                }
                SyncOutcome.DONE
            }

            is Result.Error -> {
                publishStartupException("SyncPlaylist", result.exception)
                val error = result.exception
                when {
                    error is AppError.Recoverable -> {
                        logger.w("PlayerFlow", "Recoverable error during sync (401/404). Re-registering.")
                        reRegister()
                        SyncOutcome.ABORTED
                    }
                    error is AppError.Retryable || error is AppError.DebugException -> SyncOutcome.RETRY
                    else -> {
                        stopPolling()
                        stateMachine.transitionToError(error as? AppError ?: AppError.Fatal(error.message ?: "Sync failed"))
                        SyncOutcome.ABORTED
                    }
                }
            }
        }
    }

    private fun reRegister() {
        applicationScope.launch {
            deviceRepository.clearRegistration()
            stopPolling()
            stateMachine.transitionTo(PlayerState.REGISTERING)
            executeCommand(PlayerCommand.RegisterDevice)
        }
    }

    private fun publishStartupException(command: String, exception: Exception) {
        val sw = java.io.StringWriter()
        exception.printStackTrace(java.io.PrintWriter(sw))
        val debug = exception as? AppError.DebugException
        eventBus.publish(
            PlayerEvent.StartupException(
                state = stateMachine.currentState.value.name,
                command = command,
                exceptionClass = debug?.exceptionClass ?: exception::class.java.name,
                exceptionMessage = debug?.exceptionMessage ?: (exception.message ?: "No message"),
                stackTrace = debug?.stackTrace ?: sw.toString(),
                cause = debug?.causeMessage ?: exception.cause?.message
            )
        )
    }

    private suspend fun currentCoroutineIsActive(): Boolean =
        kotlinx.coroutines.currentCoroutineContext()[Job]?.isActive != false

    // ---------------------------------------------------------------------------------------------
    // Periodic loops
    // ---------------------------------------------------------------------------------------------

    private fun startPolling() {
        if (pollingJob?.isActive == true) return
        pollingJob = applicationScope.launch {
            while (isActive) {
                delay(PLAYLIST_POLL_INTERVAL_MS)
                val currentState = stateMachine.currentState.value
                val isSyncable = when (currentState) {
                    PlayerState.BOOTING,
                    PlayerState.REGISTERING,
                    PlayerState.SYNCING,
                    PlayerState.ERROR -> false
                    else -> true
                }
                if (isSyncable) {
                    logger.d("SyncTrace", "Periodic sync in state ${currentState.name}")
                    executeCommand(PlayerCommand.SyncPlaylist)
                }
            }
        }
    }

    private fun stopPolling() {
        pollingJob?.cancel()
        pollingJob = null
    }

    /**
     * Primary heartbeat: runs for the whole process lifetime and sends a heartbeat whenever a
     * device id exists, regardless of player state, so the CMS never marks a live device Offline.
     */
    private fun startHeartbeatLoop() {
        if (heartbeatJob?.isActive == true) return
        heartbeatJob = applicationScope.launch {
            while (isActive) {
                try {
                    if (stateMachine.currentState.value != PlayerState.REGISTERING) {
                        heartbeatManager.sendHeartbeatNow()
                    }
                } catch (e: Exception) {
                    logger.w("Heartbeat", "Heartbeat loop iteration failed: ${e.message}")
                }
                val intervalSeconds = try {
                    heartbeatManager.heartbeatIntervalSeconds()
                } catch (e: Exception) {
                    com.digitalsignage.player.workers.heartbeat.HeartbeatManager.DEFAULT_INTERVAL_SECONDS
                }
                delay(TimeUnit.SECONDS.toMillis(intervalSeconds))
            }
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Activity lifecycle
    // ---------------------------------------------------------------------------------------------

    override fun attachActivity(activity: Activity) {
        currentActivity = activity
        val state = stateMachine.currentState.value
        if (state == PlayerState.READY || state == PlayerState.PLAYING) {
            kioskManager.enableKiosk(activity)
            eventBus.publish(PlayerEvent.KioskStateChanged(kioskManager.isKioskActive()))
        }
    }

    override fun detachActivity(activity: Activity) {
        // A stale Activity instance (replaced by a relaunch) must not tear down the live one.
        if (currentActivity !== activity) return
        kioskManager.disableKiosk(activity)
        currentActivity = null
    }

    override fun onUserInteraction() {
        maintenanceSessionManager.onUserInteraction()
    }

    override fun requestMaintenance() {
        if (currentActivity != null) {
            eventBus.publish(PlayerEvent.MaintenanceRequested)
        } else {
            logger.w("PlayerOrchestrator", "Cannot start maintenance: No active UI")
        }
    }

    override fun onMaintenanceAuthorized() {
        maintenanceSessionManager.startSession()
    }
}
