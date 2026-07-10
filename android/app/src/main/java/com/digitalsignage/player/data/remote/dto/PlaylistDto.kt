package com.digitalsignage.player.data.remote.dto

import com.squareup.moshi.Json

object DeviceOrientation {
    const val LANDSCAPE = "LANDSCAPE"
    const val PORTRAIT_RIGHT = "PORTRAIT_RIGHT"
    const val PORTRAIT_LEFT = "PORTRAIT_LEFT"
    const val UPSIDE_DOWN = "UPSIDE_DOWN"
}

@com.squareup.moshi.JsonClass(generateAdapter = true)
data class PlaylistSyncResponse(
    @Json(name = "playlistId") val playlistId: String,
    @Json(name = "playlistName") val playlistName: String,
    @Json(name = "playlistVersion") val version: Long,
    @Json(name = "updatedAt") val updatedAt: Long,
    @Json(name = "items") val items: List<PlaylistItemWithMediaResponse>,
    @Json(name = "deviceOrientation") val deviceOrientation: String? = DeviceOrientation.LANDSCAPE
)

@com.squareup.moshi.JsonClass(generateAdapter = true)
data class PlaylistItemWithMediaResponse(
    @Json(name = "id") val id: String,
    @Json(name = "mediaId") val mediaId: String,
    @Json(name = "order") val order: Int,
    @Json(name = "duration") val duration: Long,
    @Json(name = "media") val media: PlaylistMediaItemResponse
)

@com.squareup.moshi.JsonClass(generateAdapter = true)
data class PlaylistMediaItemResponse(
    @Json(name = "mediaId") val mediaId: String,
    @Json(name = "name") val name: String,
    @Json(name = "type") val type: String,
    @Json(name = "size") val size: Long,
    @Json(name = "duration") val duration: Long? = null,
    @Json(name = "downloadUrl") val downloadUrl: String,
    @Json(name = "checksum") val checksum: String? = null,
    @Json(name = "mimeType") val mimeType: String? = null
)


