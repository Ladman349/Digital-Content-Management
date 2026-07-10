package com.digitalsignage.player.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import kotlinx.coroutines.flow.Flow
import com.digitalsignage.player.domain.model.PlaylistState

@Dao
interface PlaylistDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPlaylist(playlist: PlaylistEntity)

    @Query("SELECT * FROM playlist WHERE state = :state LIMIT 1")
    suspend fun getPlaylistByState(state: PlaylistState): PlaylistEntity?
    
    @Query("SELECT * FROM playlist WHERE state = 'ACTIVE' LIMIT 1")
    fun observeActivePlaylist(): Flow<PlaylistEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMediaItems(items: List<MediaItemEntity>)

    @Query("SELECT * FROM media_item WHERE playlistId = :playlistId ORDER BY displayOrder ASC")
    suspend fun getMediaItemsForPlaylist(playlistId: String): List<MediaItemEntity>

    @Query("UPDATE playlist SET state = 'ARCHIVED' WHERE state = 'ACTIVE'")
    suspend fun archiveActivePlaylist()
    
    @Query("UPDATE playlist SET state = 'ACTIVE' WHERE playlistId = :playlistId AND state = 'PENDING'")
    suspend fun activatePendingPlaylist(playlistId: String)
    
    @Query("UPDATE media_item SET isDownloaded = :isDownloaded, localFilePath = :filePath WHERE mediaId = :mediaId")
    suspend fun updateMediaDownloadedState(mediaId: String, isDownloaded: Boolean, filePath: String)
    
    @Query("SELECT COUNT(*) FROM media_item WHERE playlistId = :playlistId AND isDownloaded = 0")
    suspend fun countIncompleteMediaItems(playlistId: String): Int
    
    @Transaction
    suspend fun insertPendingPlaylistTransaction(playlist: PlaylistEntity, items: List<MediaItemEntity>) {
        insertPlaylist(playlist)
        insertMediaItems(items)
    }

    @Query("DELETE FROM playlist WHERE playlistId = :playlistId")
    suspend fun deletePlaylistById(playlistId: String)

    @Query("DELETE FROM media_item WHERE playlistId = :playlistId")
    suspend fun deleteMediaItemsForPlaylist(playlistId: String)

    @Transaction
    suspend fun deletePlaylist(playlistId: String) {
        deleteMediaItemsForPlaylist(playlistId)
        deletePlaylistById(playlistId)
    }
}

@Dao
interface DownloadSessionDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTasks(tasks: List<DownloadSessionEntity>)

    @Query("SELECT * FROM download_session WHERE downloadState IN ('QUEUED', 'DOWNLOADING') ORDER BY priority DESC LIMIT 5")
    suspend fun getPendingTasks(): List<DownloadSessionEntity>

    @Query("UPDATE download_session SET currentByteOffset = :offset, updatedAt = :updatedAt WHERE mediaId = :mediaId")
    suspend fun updateSessionOffset(mediaId: String, offset: Long, updatedAt: Long)

    @Query("UPDATE download_session SET downloadState = :state, updatedAt = :updatedAt WHERE mediaId = :mediaId")
    suspend fun updateSessionState(mediaId: String, state: com.digitalsignage.player.domain.model.DownloadState, updatedAt: Long)

    @Query("UPDATE download_session SET retryCount = :count, updatedAt = :updatedAt WHERE mediaId = :mediaId")
    suspend fun incrementRetryCount(mediaId: String, count: Int, updatedAt: Long)
}


