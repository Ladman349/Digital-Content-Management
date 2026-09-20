package com.digitalsignage.player.data.remote.dto

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class PlayEventDto(
    @Json(name = "mediaId") val mediaId: String,
    @Json(name = "playlistId") val playlistId: String? = null,
    @Json(name = "startedAt") val startedAt: Long,
    @Json(name = "durationMs") val durationMs: Long,
    @Json(name = "completed") val completed: Boolean = true
)

@JsonClass(generateAdapter = true)
data class PlayBatchPayload(
    @Json(name = "batchId") val batchId: String,
    /** This device's clock at the moment of sending, so the server can correct a wrong clock. */
    @Json(name = "sentAt") val sentAt: Long,
    @Json(name = "events") val events: List<PlayEventDto>
)
