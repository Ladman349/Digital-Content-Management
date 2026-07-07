package com.digitalsignage.player.domain.repository

import kotlinx.coroutines.flow.Flow
import com.digitalsignage.player.domain.model.Playlist

sealed class Result<out T> {
    data class Success<T>(val data: T) : Result<T>()
    data class Error(val exception: Exception) : Result<Nothing>()
}

interface DeviceRepository {
    suspend fun registerDevice(): Result<Boolean>
    fun observeRegistrationState(): Flow<Boolean>
}

interface PlaylistRepository {
    suspend fun syncPlaylist(): Result<Boolean>
    fun observeCurrentPlaylist(): Flow<Playlist?>
}

interface MediaRepository {
    suspend fun downloadMedia(mediaId: String): Result<Boolean>
    fun observeDownloadProgress(mediaId: String): Flow<Int>
}

interface HeartbeatRepository {
    suspend fun sendHeartbeat(): Result<Unit>
}
