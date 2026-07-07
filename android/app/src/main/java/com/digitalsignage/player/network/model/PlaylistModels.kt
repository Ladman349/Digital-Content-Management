package com.digitalsignage.player.network.model

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class PlaylistMediaItem(
    val mediaId: String,
    val name: String,
    val type: String,
    val size: Int,
    val duration: Int?,
    val downloadUrl: String,
    val checksum: String?
)

@JsonClass(generateAdapter = true)
data class PlaylistItemWithMedia(
    val id: String,
    val mediaId: String,
    val order: Int,
    val duration: Int,
    val media: PlaylistMediaItem
)

@JsonClass(generateAdapter = true)
data class CurrentPlaylistResponse(
    val playlistId: String,
    val playlistName: String,
    val playlistVersion: Long,
    val updatedAt: Long,
    val items: List<PlaylistItemWithMedia>
)
