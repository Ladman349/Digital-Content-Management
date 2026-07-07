package com.digitalsignage.player.data.remote.dto

import com.squareup.moshi.Json

@com.squareup.moshi.JsonClass(generateAdapter = true)
data class PlaylistSyncResponse(
    @Json(name = "playlistId") val playlistId: String,
    @Json(name = "playlistName") val playlistName: String,
    @Json(name = "playlistVersion") val version: Long,
    @Json(name = "updatedAt") val updatedAt: Long,
    @Json(name = "items") val items: List<PlaylistItemWithMediaResponse>
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


