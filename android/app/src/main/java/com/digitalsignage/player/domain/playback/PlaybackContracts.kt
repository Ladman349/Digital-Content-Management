package com.digitalsignage.player.domain.playback

import com.digitalsignage.player.domain.model.Playlist

// Orchestration Layer (Domain)
interface PlaylistExecutor {
    fun execute(playlist: Playlist)
    suspend fun stop()
}

// Hardware-agnostic Engine Contract (Player layer contract exposed to Domain)
// Moving the interface back to domain/playback to respect Dependency Inversion.
// The concrete ExoPlayer implementation remains in the player package.
interface PlaybackController {
    fun initialize()
    suspend fun playItem(item: com.digitalsignage.player.domain.model.MediaItem)
    fun preloadItem(item: com.digitalsignage.player.domain.model.MediaItem)
    suspend fun stop()
    suspend fun release()
    fun isPlaying(): Boolean
    fun getCurrentMediaId(): String?
    fun getCurrentPlaylistId(): String?
    fun setCurrentPlaylistId(playlistId: String?)
}
