package com.digitalsignage.player.network.model

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class DeviceRegisterRequest(
    val name: String,
    val resolution: String,
    val ipAddress: String?,
    val appVersion: String?,
    val androidId: String?
)

@JsonClass(generateAdapter = true)
data class DeviceRegisterResponse(
    val deviceId: String,
    val deviceToken: String,
    val heartbeatInterval: Int,
    val syncInterval: Int,
    val backendTime: String
)

@JsonClass(generateAdapter = true)
data class HeartbeatRequest(
    val deviceId: String,
    val sequenceNumber: Long,
    val sessionId: String?,
    val playerState: String,
    val completedItems: Int,
    val playbackErrors: Int,
    val cacheUsagePercent: Float,
    val storageUsed: Float?,
    val storageTotal: Float?,
    val currentPlaylistId: String?,
    val currentMediaId: String?,
    val appVersion: String?,
    val uptimeSeconds: Long?,
    val ipAddress: String?,
    val firmwareVersion: String?
)


