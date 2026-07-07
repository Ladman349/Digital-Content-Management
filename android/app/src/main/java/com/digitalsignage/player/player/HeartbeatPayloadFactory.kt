package com.digitalsignage.player.player

import com.digitalsignage.player.network.model.HeartbeatRequest

/**
 * Isolates the creation of network DTOs from the domain models.
 * Ensures networking code does not leak into the playback layer.
 */
class HeartbeatPayloadFactory(
    private val deviceId: String
) {
    fun createPayload(
        runtime: RuntimeSnapshot,
        health: HealthSnapshot,
        capabilities: DeviceCapabilities,
        sequenceNumber: Long
    ): HeartbeatRequest {
        return HeartbeatRequest(
            deviceId = deviceId,
            sequenceNumber = sequenceNumber,
            sessionId = runtime.sessionId,
            playerState = runtime.playerState,
            completedItems = runtime.completedItems,
            playbackErrors = runtime.playbackErrors,
            cacheUsagePercent = health.cacheUsagePercent,
            storageUsed = health.storageUsedMb,
            storageTotal = health.storageTotalMb,
            currentPlaylistId = runtime.currentPlaylistId,
            currentMediaId = runtime.currentMediaId,
            appVersion = capabilities.appVersion,
            uptimeSeconds = health.uptimeSeconds,
            ipAddress = null, // Will be resolved by backend or a network utility if needed
            firmwareVersion = capabilities.androidVersion
        )
    }
}
