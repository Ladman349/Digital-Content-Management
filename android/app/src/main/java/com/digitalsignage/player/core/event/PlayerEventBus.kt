package com.digitalsignage.player.core.event

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import javax.inject.Inject
import javax.inject.Singleton

sealed class PlayerEvent {
    object BootCompleted : PlayerEvent()
    object RecoveryStarted : PlayerEvent()
    object RecoveryCompleted : PlayerEvent()
    data class RecoveryFailed(val reason: String) : PlayerEvent()
    data class CrashDetected(val timestamp: Long, val message: String) : PlayerEvent()
    object RestartScheduled : PlayerEvent()
    object SplashCompleted : PlayerEvent()
    object RegistrationSucceeded : PlayerEvent()
    object RegistrationFailed : PlayerEvent()
    data class DebugStage(val stageName: String) : PlayerEvent()
    data class StartupException(
        val state: String,
        val command: String,
        val exceptionClass: String,
        val exceptionMessage: String,
        val stackTrace: String,
        val cause: String?
    ) : PlayerEvent()
    object RegistrationStarted : PlayerEvent()
    object RegistrationRetried : PlayerEvent()
    object RegistrationRecovered : PlayerEvent()
    object PlaylistUpdated : PlayerEvent()
    data class DownloadCompleted(val mediaId: String) : PlayerEvent()
    data class DownloadStarted(val mediaId: String) : PlayerEvent()
    data class DownloadProgress(val mediaId: String, val progress: Int) : PlayerEvent()
    data class DownloadFailed(val mediaId: String, val error: Exception) : PlayerEvent()
    object PlaylistReady : PlayerEvent()
    object HeartbeatStarted : PlayerEvent()
    object HeartbeatSucceeded : PlayerEvent()
    data class HeartbeatFailed(val error: Exception) : PlayerEvent()
    data class MediaItemTransitioned(val oldMediaId: String?, val newMediaId: String) : PlayerEvent()
    object EngineInitialized : PlayerEvent()
    
    // Playback Events
    data class PlaybackStarted(val mediaId: String) : PlayerEvent()
    data class PlaybackCompleted(val mediaId: String) : PlayerEvent()
    data class PlaybackPaused(val mediaId: String) : PlayerEvent()
    data class PlaybackResumed(val mediaId: String) : PlayerEvent()
    data class PlaybackFailed(val mediaId: String, val error: Exception) : PlayerEvent()
    object PlaylistCompleted : PlayerEvent()
    object PlaylistLooped : PlayerEvent()
    
    // Kiosk & Maintenance
    data class KioskStateChanged(val isActive: Boolean) : PlayerEvent()
    object MaintenanceStarted : PlayerEvent()
    object MaintenanceEnded : PlayerEvent()
    object MaintenanceRequested : PlayerEvent()
    
    object DeviceNotProvisioned : PlayerEvent()
    
    data class NetworkRestored(val available: Boolean = true) : PlayerEvent()
    data class NetworkLost(val available: Boolean = false) : PlayerEvent()
    data class FatalError(val exception: Exception) : PlayerEvent()
}

@Singleton
class PlayerEventBus @Inject constructor() {
    private val _events = MutableSharedFlow<PlayerEvent>(extraBufferCapacity = 50)
    val events: SharedFlow<PlayerEvent> = _events.asSharedFlow()

    fun publish(event: PlayerEvent) {
        _events.tryEmit(event)
    }
}



