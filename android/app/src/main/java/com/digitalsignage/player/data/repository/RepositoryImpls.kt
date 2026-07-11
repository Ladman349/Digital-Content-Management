package com.digitalsignage.player.data.repository

import com.digitalsignage.player.core.error.AppError
import com.digitalsignage.player.core.logging.Logger
import com.digitalsignage.player.data.local.AppDatabase
import com.digitalsignage.player.data.local.DownloadSessionEntity
import com.digitalsignage.player.data.local.MediaItemEntity
import com.digitalsignage.player.data.local.PlaylistEntity
import com.digitalsignage.player.data.local.datastore.RuntimeConfigStoreImpl
import com.digitalsignage.player.data.remote.ApiService
import com.digitalsignage.player.domain.model.DownloadState
import com.digitalsignage.player.domain.model.MediaItem
import com.digitalsignage.player.domain.model.MediaType
import com.digitalsignage.player.domain.model.Playlist
import com.digitalsignage.player.domain.model.PlaylistState
import com.digitalsignage.player.domain.repository.PlaylistRepository
import com.digitalsignage.player.domain.repository.Result
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.map
import com.digitalsignage.player.core.event.PlayerEvent
import com.digitalsignage.player.core.event.PlayerEventBus
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PlaylistRepositoryImpl @Inject constructor(
    private val apiService: ApiService,
    private val database: AppDatabase,
    private val configStore: RuntimeConfigStoreImpl,
    private val logger: Logger,
    private val eventBus: PlayerEventBus
) : PlaylistRepository {

    override suspend fun syncPlaylist(): Result<Boolean> {
        val result = syncPlaylistInternal()
        if (result is Result.Success) {
            eventBus.publish(PlayerEvent.DebugStage("syncPlaylist() returning Result.Success"))
        } else if (result is Result.Error) {
            eventBus.publish(PlayerEvent.DebugStage("syncPlaylist() returning Result.Error. Type: ${result.exception::class.java.name}, Message: ${result.exception.message}"))
        }
        return result
    }

    private suspend fun syncPlaylistInternal(): Result<Boolean> {
        android.util.Log.i("SyncTrace", "Entered syncPlaylistInternal()")
        android.util.Log.i("StartupTrace", "Trace: PlaylistRepositoryImpl.syncPlaylist() started")
        return try {
            val deviceId = configStore.deviceId.firstOrNull()
            eventBus.publish(
                PlayerEvent.DebugStage(
                    "DEVICE_ID_AT_SYNC = '$deviceId'"
                )
            )
            if (deviceId.isNullOrEmpty()) {
                logger.e("PlaylistRepository", "Device ID is missing")
                return Result.Error(AppError.Recoverable("Missing device ID"))
            }

            val currentETag = configStore.playlistETag.firstOrNull()
            eventBus.publish(
                PlayerEvent.DebugStage(
                    "ETAG_AT_SYNC = '$currentETag'"
                )
            )
            
            logger.d("PlaylistRepository", "Requesting playlist sync with If-None-Match: ${currentETag}")
            val response = apiService.getPlaylist(deviceId, currentETag)
            android.util.Log.i("SyncTrace", "Playlist response code = ${response.code()}")
            android.util.Log.i("SyncTrace", "Request ETag = $currentETag")
            android.util.Log.i("SyncTrace", "Response ETag = ${response.headers()["ETag"]}")
            android.util.Log.i("SyncTrace", "response.isSuccessful = ${response.isSuccessful}")
            
            eventBus.publish(PlayerEvent.DebugStage("--- PLAYLIST SYNC ---"))
            eventBus.publish(PlayerEvent.DebugStage("1. GET /devices/$deviceId/current-playlist returned HTTP ${response.code()}"))
            
            val isSuccess = response.isSuccessful
            
            if (response.code() == 204) {
                logger.i("PlaylistRepository", "204 No Content — no playlist assigned to this device.")
                android.util.Log.i("SyncTrace", "204 No Content — clearing active playlist")
                eventBus.publish(PlayerEvent.DebugStage("204 No Content — no active playlist for device"))
                
                // Clear active playlist from local DB so player shows idle screen
                val activePlaylist = database.playlistDao().getPlaylistByState(PlaylistState.ACTIVE)
                if (activePlaylist != null) {
                    database.playlistDao().deletePlaylist(activePlaylist.playlistId)
                    android.util.Log.i("SyncTrace", "Cleared active playlist ${activePlaylist.playlistId} from local DB")
                }
                
                Result.Success(false)
            } else if (isSuccess) {
                eventBus.publish(PlayerEvent.DebugStage("C. About to evaluate response.body()"))
                val body = response.body()
                eventBus.publish(PlayerEvent.DebugStage("D. Finished evaluating response.body(): isNull=${body == null}"))
                
                eventBus.publish(PlayerEvent.DebugStage("E. About to call body.string()"))
                val rawJson = body?.string() ?: ""
                eventBus.publish(PlayerEvent.DebugStage("F. Finished calling body.string(), length=${rawJson.length}"))
                
                eventBus.publish(PlayerEvent.DebugStage("2. COMPLETE response body:\n$rawJson"))
                
                eventBus.publish(PlayerEvent.DebugStage("G. About to read headers"))
                val newETag = response.headers()["ETag"]
                eventBus.publish(PlayerEvent.DebugStage("H. Finished reading headers, ETag=$newETag"))
                
                if (rawJson.isNotEmpty()) {
                    eventBus.publish(PlayerEvent.DebugStage("I. About to construct Moshi"))
                    val moshi = com.squareup.moshi.Moshi.Builder()
                        .add(com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory())
                        .build()
                    eventBus.publish(PlayerEvent.DebugStage("J. Moshi constructed"))
                    val adapter = moshi.adapter(com.digitalsignage.player.data.remote.dto.PlaylistSyncResponse::class.java)
                    
                    val syncData = adapter.fromJson(rawJson)
                    
                    if (syncData != null) {
                        val orientation = syncData.deviceOrientation ?: com.digitalsignage.player.data.remote.dto.DeviceOrientation.LANDSCAPE
                        android.util.Log.i("OrientationSync", "Received orientation=$orientation")
                        configStore.saveDeviceOrientation(orientation)
                        
                        android.util.Log.i("PlaylistTrace", "Received playlist version=${syncData.version}, items=${syncData.items.map { it.media.mediaId }}")
                        eventBus.publish(PlayerEvent.DebugStage("3. Parsed Playlist object:\n$syncData"))
                        eventBus.publish(PlayerEvent.DebugStage("3a. Parsed Class: ${syncData::class.java.name}"))
                        eventBus.publish(PlayerEvent.DebugStage("4. playlist.id = ${syncData.playlistId}"))
                        eventBus.publish(PlayerEvent.DebugStage("5. playlist.mediaItems.size = ${syncData.items.size}"))
                        val currentActive = database.playlistDao().getPlaylistByState(PlaylistState.ACTIVE)
                        val currentPending = database.playlistDao().getPlaylistByState(PlaylistState.PENDING)
                        
                        val isAlreadyActive = currentActive != null && 
                                currentActive.playlistId == syncData.playlistId && 
                                currentActive.version == syncData.version
                                
                        val isAlreadyPending = currentPending != null && 
                                currentPending.playlistId == syncData.playlistId && 
                                currentPending.version == syncData.version
                                
                        if (isAlreadyActive || isAlreadyPending) {
                            logger.i("PlaylistRepository", "Playlist version ${syncData.version} is already active/pending in DB. Ignoring sync.")
                            return Result.Success(false)
                        }

                        logger.i("PlaylistRepository", "New playlist version ${syncData.version} received. Saving as PENDING.")
                        
                        val entity = PlaylistEntity(
                            playlistId = syncData.playlistId,
                            version = syncData.version,
                            state = PlaylistState.PENDING,
                            lastSyncedAt = System.currentTimeMillis()
                        )
                        
                        val activePlaylist = database.playlistDao().getPlaylistByState(PlaylistState.ACTIVE)
                        val activeItems = activePlaylist?.let { database.playlistDao().getMediaItemsForPlaylist(it.playlistId) } ?: emptyList()
                        
                        android.util.Log.i("SyncTrace", "1. activeItems size: ${activeItems.size}")
                        activeItems.forEach {
                            android.util.Log.i("SyncTrace", "2. Existing MediaItem - mediaId: ${it.mediaId}, isDownloaded: ${it.isDownloaded}, localFilePath: ${it.localFilePath}")
                        }
                        
                        val itemEntities = syncData.items.mapIndexed { index, wrapper ->
                            val dto = wrapper.media
                            eventBus.publish(PlayerEvent.DebugStage("6. MediaItem[$index]: id=${dto.mediaId}, url=${dto.downloadUrl}"))
                            val existingItem = activeItems.find { it.mediaId == dto.mediaId }
                            
                            MediaItemEntity(
                                mediaId = dto.mediaId,
                                playlistId = syncData.playlistId,
                                url = dto.downloadUrl,
                                durationMs = wrapper.duration * 1000L,
                                displayOrder = wrapper.order,
                                md5Hash = null,
                                sha256Hash = dto.checksum,
                                mediaType = dto.type,
                                isDownloaded = existingItem?.isDownloaded ?: false,
                                localFilePath = existingItem?.localFilePath,
                                mimeType = dto.mimeType
                            )
                        }
                        
                        // Metadata update only in transaction
                        database.playlistDao().insertPendingPlaylistTransaction(entity, itemEntities)
                        android.util.Log.i("PlaylistTrace", "Inserted pending playlist")
                        
                        // Store ETag independently of version
                        if (newETag != null) {
                            configStore.savePlaylistETag(newETag)
                        }
                        
                        val itemsToDownload = itemEntities.filter { !it.isDownloaded }
                        
                        android.util.Log.i("SyncTrace", "3. itemEntities size: ${itemEntities.size}")
                        android.util.Log.i("SyncTrace", "4. itemsToDownload size: ${itemsToDownload.size}")
                        
                        eventBus.publish(PlayerEvent.DebugStage("About to call enqueueDownloads()"))
                        
                        // Queue downloads via persistent storage
                        enqueueDownloads(itemsToDownload)
                        
                        eventBus.publish(PlayerEvent.DebugStage("enqueueDownloads() returned successfully"))
                        
                        Result.Success(true)
                    } else {
                        Result.Error(AppError.Retryable("Parsed syncData is null"))
                    }
                } else {
                    Result.Error(AppError.Retryable("Empty response body"))
                }
            } else if (response.code() == 304) {
                logger.i("PlaylistRepository", "Playlist not modified. ETag ${currentETag} is up to date.")
                Result.Success(false)
            } else if (response.code() == 401 || response.code() == 404) {
                logger.e("PlaylistRepository", "Device not found or unauthorized: ${response.code()}")
                Result.Error(AppError.Recoverable("Device unauthorized or not found: ${response.code()}"))
            } else {
                Result.Error(AppError.Retryable("Failed to fetch playlist: ${response.code()}"))
            }
        } catch (e: Exception) {
            logger.e("PlaylistRepository", "Exception during sync", e)
            val sw = java.io.StringWriter()
            e.printStackTrace(java.io.PrintWriter(sw))
            eventBus.publish(PlayerEvent.DebugStage("SYNC EXCEPTION: ${e::class.java.name}\n${sw.toString()}"))
            Result.Error(AppError.Retryable("Network error", e))
        }
    }

    override fun observeCurrentPlaylist(): Flow<Playlist?> {
        return database.playlistDao().observeActivePlaylist().map { entity ->
            if (entity == null) return@map null
            android.util.Log.i("PlaylistTrace", "ROOM EMIT playlist=${entity.playlistId} version=${entity.version}")
            val items = database.playlistDao().getMediaItemsForPlaylist(entity.playlistId).map {
                MediaItem(
                    mediaId = it.mediaId,
                    url = it.url,
                    durationMs = it.durationMs,
                    order = it.displayOrder,
                    md5Hash = it.md5Hash,
                    sha256Hash = it.sha256Hash,
                    mediaType = mapMediaType(it.mediaType),
                    isDownloaded = it.isDownloaded,
                    localFilePath = it.localFilePath,
                    mimeType = it.mimeType
                )
            }
            Playlist(entity.playlistId, entity.version, entity.state, items)
        }
    }
    
    private suspend fun enqueueDownloads(itemsToDownload: List<MediaItemEntity>) {
        if (itemsToDownload.isNotEmpty()) {
            val tasks = itemsToDownload.map { item ->
                DownloadSessionEntity(
                    mediaId = item.mediaId,
                    url = item.url,
                    downloadState = DownloadState.QUEUED,
                    retryCount = 0,
                    priority = 10,
                    expectedChecksumMd5 = null,
                    expectedChecksumSha256 = item.sha256Hash,
                    createdAt = System.currentTimeMillis(),
                    updatedAt = System.currentTimeMillis(),
                    destinationPath = item.localFilePath ?: ""
                )
            }
            database.downloadSessionDao().insertTasks(tasks)
            val inserted = database.downloadSessionDao().getPendingTasks()
            android.util.Log.i(
                "SyncTrace",
                "After insert: pendingTasks=${inserted.size}"
            )
            logger.logEvent("MediaDownloadQueuedToDB", mapOf("count" to tasks.size))
            eventBus.publish(PlayerEvent.DebugStage("enqueueDownloads: CREATED ${tasks.size} tasks!"))
        } else {
            eventBus.publish(PlayerEvent.DebugStage("enqueueDownloads: CREATED 0 tasks because itemsToDownload was empty!"))
        }
    }
    
    private fun mapMediaType(typeStr: String): MediaType {
        return try {
            MediaType.valueOf(typeStr.uppercase())
        } catch (e: Exception) {
            MediaType.UNKNOWN
        }
    }
}


