package com.digitalsignage.player.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.ForeignKey
import androidx.room.Index
import com.digitalsignage.player.domain.model.DownloadState
import com.digitalsignage.player.domain.model.PlaylistState

@Entity(tableName = "playlist")
data class PlaylistEntity(
    @PrimaryKey val playlistId: String,
    val version: Long,
    val state: PlaylistState,
    val lastSyncedAt: Long
)

@Entity(
    tableName = "media_item",
    foreignKeys = [
        ForeignKey(
            entity = PlaylistEntity::class,
            parentColumns = ["playlistId"],
            childColumns = ["playlistId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("playlistId")]
)
data class MediaItemEntity(
    @PrimaryKey val mediaId: String,
    val playlistId: String,
    val url: String,
    val durationMs: Long,
    val displayOrder: Int,
    val md5Hash: String?,
    val sha256Hash: String?,
    val mediaType: String,
    val isDownloaded: Boolean = false,
    val localFilePath: String? = null,
    val mimeType: String? = null
)

@Entity(tableName = "download_session")
data class DownloadSessionEntity(
    @PrimaryKey val mediaId: String,
    val url: String,
    val downloadState: DownloadState,
    val currentByteOffset: Long = 0L,
    val expectedSize: Long = 0L,
    val expectedChecksumMd5: String?,
    val expectedChecksumSha256: String?,
    val retryCount: Int = 0,
    val priority: Int = 0,
    val destinationPath: String,
    val createdAt: Long,
    val updatedAt: Long
)
