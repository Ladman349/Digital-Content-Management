package com.digitalsignage.player.player

import java.io.File

/**
 * Domain model representing a single playable media item.
 * Decoupled from network DTOs and Room entities.
 * PlaybackEngine depends ONLY on this type.
 */
sealed class PlayableMedia {
    abstract val mediaId: String
    abstract val name: String
    abstract val durationSeconds: Int
    abstract val localFile: File
    abstract val order: Int

    data class Image(
        override val mediaId: String,
        override val name: String,
        override val durationSeconds: Int,
        override val localFile: File,
        override val order: Int
    ) : PlayableMedia()

    data class Video(
        override val mediaId: String,
        override val name: String,
        override val durationSeconds: Int,
        override val localFile: File,
        override val order: Int
    ) : PlayableMedia()
}
