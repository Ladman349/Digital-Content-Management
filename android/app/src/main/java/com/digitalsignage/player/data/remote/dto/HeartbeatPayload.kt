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
    @Json(name = "firmwareVersion") val firmwareVersion: String? = null,
    // Health, from 1.4.0. An older backend ignores fields it does not know.
    @Json(name = "lastError") val lastError: String? = null,
    @Json(name = "lastErrorAt") val lastErrorAt: Long? = null,
    @Json(name = "pendingPlays") val pendingPlays: Int? = null
)

/** The part of the heartbeat reply the player acts on. Everything else in the body is ignored. */
@com.squareup.moshi.JsonClass(generateAdapter = true)
data class HeartbeatReply(
    @Json(name = "screenshotRequested") val screenshotRequested: Boolean = false
)

