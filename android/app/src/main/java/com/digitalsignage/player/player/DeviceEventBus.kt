package com.digitalsignage.player.player

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow

sealed class DeviceEvent {
    data class PlaybackStarted(val playlistId: String?) : DeviceEvent()
    data class PlaybackCompleted(val mediaId: String?) : DeviceEvent()
    data class PlaylistChanged(val newVersion: Long) : DeviceEvent()
    object ConnectivityLost : DeviceEvent()
    object ConnectivityRestored : DeviceEvent()
    data class HeartbeatSucceeded(val sequenceNumber: Long) : DeviceEvent()
    data class HeartbeatFailed(val sequenceNumber: Long, val code: Int) : DeviceEvent()
    object BootCompleted : DeviceEvent()
}

/**
 * Singleton event bus for decoupling application components.
 */
object DeviceEventBus {
    private val _events = MutableSharedFlow<DeviceEvent>(extraBufferCapacity = 64)
    val events = _events.asSharedFlow()

    fun publish(event: DeviceEvent) {
        _events.tryEmit(event)
    }
}
