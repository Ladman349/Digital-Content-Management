package com.digitalsignage.player.domain.playback.executor

import com.digitalsignage.player.core.event.PlayerEvent
import com.digitalsignage.player.core.event.PlayerEventBus
import com.digitalsignage.player.core.logging.Logger
import com.digitalsignage.player.domain.model.Playlist
import com.digitalsignage.player.domain.playback.PlaybackController
import com.digitalsignage.player.domain.playback.PlaylistExecutor
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.CancellationException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PlaylistExecutorImpl @Inject constructor(
    private val playbackController: PlaybackController,
    private val eventBus: PlayerEventBus,
    private val logger: Logger
) : PlaylistExecutor {

    private var currentPlaylistId: String? = null
    private var currentPlaylistVersion: Long? = null
    private var pendingPlaylist: Playlist? = null
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private var loopJob: Job? = null

    override fun execute(playlist: Playlist) {
        com.digitalsignage.player.core.performance.PerformanceMonitor.onPlaylistSelected()
        if (playlist.playlistId == currentPlaylistId && playlist.version == currentPlaylistVersion) {
            return
        }
        
        logger.i("PlaylistExecutor", "Request to execute playlist: ${playlist.playlistId}, version: ${playlist.version}")
        
        if (playlist.items.isEmpty()) {
            logger.i("PlaylistExecutor", "Playlist is empty. Stopping playback immediately.")
            scope.launch {
                stop()
            }
            return
        }
        
        scope.launch {
            playbackController.initialize()
            
            if (playbackController.isPlaying()) {
                logger.i("PlaylistExecutor", "Playback is active. Queueing as pending to finish current item.")
                pendingPlaylist = playlist
            } else {
                currentPlaylistId = playlist.playlistId
                currentPlaylistVersion = playlist.version
                playbackController.setCurrentPlaylistId(playlist.playlistId)
                startPlaylistLoop(playlist)
            }
        }
    }

    private fun startPlaylistLoop(playlist: Playlist) {
        loopJob?.cancel()
        loopJob = scope.launch {
            var currentIndex = 0
            while (isActive) {
                if (playlist.items.isEmpty()) {
                    logger.i("PlaylistExecutor", "Playlist items are empty in loop. Stopping controller.")
                    playbackController.stop()
                    delay(1000)
                    continue
                }
                
                if (currentIndex >= playlist.items.size) {
                    currentIndex = 0
                    eventBus.publish(PlayerEvent.PlaylistLooped)
                }
                
                val item = playlist.items[currentIndex]
                val nextIndex = (currentIndex + 1) % playlist.items.size
                val nextItem = playlist.items[nextIndex]
                if (nextItem.mediaType == com.digitalsignage.player.domain.model.MediaType.VIDEO && playlist.items.size > 1) {
                    playbackController.preloadItem(nextItem)
                }
                
                try {
                    playbackController.playItem(item)
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    logger.e("PlaylistExecutor", "Error playing media ${item.mediaId}, skipping", e)
                }
                
                val pending = pendingPlaylist
                if (pending != null) {
                    logger.i("PlaylistExecutor", "Applying pending playlist: ${pending.playlistId}, version: ${pending.version}")
                    pendingPlaylist = null
                    currentPlaylistId = pending.playlistId
                    currentPlaylistVersion = pending.version
                    playbackController.setCurrentPlaylistId(pending.playlistId)
                    startPlaylistLoop(pending)
                    break
                }
                
                currentIndex++
            }
        }
    }

    override suspend fun stop() {
        logger.i("PlaylistExecutor", "Stopping playlist execution.")
        loopJob?.cancel()
        currentPlaylistId = null
        currentPlaylistVersion = null
        pendingPlaylist = null
        playbackController.stop()
    }
}
