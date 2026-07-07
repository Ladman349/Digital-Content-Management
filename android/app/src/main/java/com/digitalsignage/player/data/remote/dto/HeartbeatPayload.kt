package com.digitalsignage.player.data.remote.dto

import com.squareup.moshi.Json

@com.squareup.moshi.JsonClass(generateAdapter = true)
data class HeartbeatPayload(
    @Json(name = "deviceId") val deviceId: String,
    @Json(name = "storageUsed") val storageUsed: Float? = null,
    @Json(name = "storageTotal") val storageTotal: Float? = null,
    @Json(name = "currentPlaylistId") val currentPlaylistId: String? = null,
    @Json(name = "currentMediaId") val currentMediaId: String? = null,
    @Json(name = "appVersion") val appVersion: String? = null,
    @Json(name = "uptimeSeconds") val uptimeSeconds: Long? = null,
    @Json(name = "ipAddress") val ipAddress: String? = null,
    @Json(name = "firmwareVersion") val firmwareVersion: String? = null
)

