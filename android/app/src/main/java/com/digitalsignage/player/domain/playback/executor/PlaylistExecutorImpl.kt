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
        android.util.Log.i("PlaylistTrace", "EXECUTE version=${playlist.version}")
        android.util.Log.i("ReadinessTrace", "PlaylistExecutor.execute() called with playlist: ${playlist.playlistId}, version: ${playlist.version}")
        android.util.Log.d("PLAYER_FLOW", "PlaylistExecutor.execute() called: ID=${playlist.playlistId}, version=${playlist.version}")
        if (playlist.playlistId == currentPlaylistId && playlist.version == currentPlaylistVersion) {
            android.util.Log.i("ReadinessTrace", "PlaylistExecutor: Playlist already active and same version: ${playlist.playlistId}")
            android.util.Log.d("PLAYER_FLOW", "PlaylistExecutor: Playlist version matches current active. Ignoring execute.")
            return
        }
        
        logger.i("PlaylistExecutor", "Request to execute playlist: ${playlist.playlistId}, version: ${playlist.version}")
        android.util.Log.i(
            "PlaylistTrace",
            "Execute playlist id=${playlist.playlistId} version=${playlist.version}"
        )
        
        if (playlist.items.isEmpty()) {
            logger.i("PlaylistExecutor", "Playlist is empty. Stopping playback immediately.")
            android.util.Log.d("PLAYER_FLOW", "PlaylistExecutor: Empty playlist, calling stop()")
            scope.launch {
                stop()
            }
            return
        }
        
        scope.launch {
            playbackController.initialize()
            
            if (playbackController.isPlaying()) {
                logger.i("PlaylistExecutor", "Playback is active. Queueing as pending to finish current item.")
                android.util.Log.d("PLAYER_FLOW", "PlaylistExecutor: Playback is active. Queueing as pendingPlaylist.")
                pendingPlaylist = playlist
            } else {
                currentPlaylistId = playlist.playlistId
                currentPlaylistVersion = playlist.version
                android.util.Log.i("PlaylistTrace", "RESTARTING LOOP for version=${playlist.version}")
                playbackController.setCurrentPlaylistId(playlist.playlistId)
                eventBus.publish(PlayerEvent.DebugStage("8. PlaylistExecutor starting loop for playlist ${playlist.playlistId}"))
                android.util.Log.d("PLAYER_FLOW", "PlaylistExecutor: Playback not active, starting loop now.")
                startPlaylistLoop(playlist)
            }
        }
    }

    private fun startPlaylistLoop(playlist: Playlist) {
        android.util.Log.i(
            "PlaylistTrace",
            "START LOOP version=${playlist.version} items=${
                playlist.items.joinToString { "${it.mediaId}:${it.order}" }
            }"
        )
        android.util.Log.i("PlaylistTrace", "Cancelling existing playback loop")
        loopJob?.cancel()
        loopJob = scope.launch {
            var currentIndex = 0
            while (isActive) {
                if (playlist.items.isEmpty()) {
                    logger.i("PlaylistExecutor", "Playlist items are empty in loop. Stopping controller.")
                    android.util.Log.d("PLAYER_FLOW", "PlaylistExecutor loop: Playlist items empty, calling playbackController.stop()")
                    playbackController.stop()
                    delay(1000)
                    continue
                }
                
                if (currentIndex >= playlist.items.size) {
                    currentIndex = 0
                    eventBus.publish(PlayerEvent.PlaylistLooped)
                }
                
                val item = playlist.items[currentIndex]
                
                try {
                    android.util.Log.i("PlaybackExecutor", "Conductor: playing item ${item.mediaId} index $currentIndex")
                    android.util.Log.d("PLAYER_FLOW", "PlaylistExecutor loop: Calling playItem for ${item.mediaId} (Order=${item.order})")
                    playbackController.playItem(item)
                    android.util.Log.d("PLAYER_FLOW", "PlaylistExecutor loop: playItem returned for ${item.mediaId}")
                    android.util.Log.i("PlaybackExecutor", "Conductor: finished item ${item.mediaId}")
                } catch (e: CancellationException) {
                    android.util.Log.d("PLAYER_FLOW", "PlaylistExecutor loop: playItem cancelled/interrupted for ${item.mediaId}")
                    throw e
                } catch (e: Exception) {
                    android.util.Log.e("PLAYER_FLOW", "PlaylistExecutor loop: playItem failed for ${item.mediaId}", e)
                    logger.e("PlaylistExecutor", "Error playing media ${item.mediaId}, skipping", e)
                }
                
                val pending = pendingPlaylist
                if (pending != null) {
                    android.util.Log.i("PlaylistTrace", "RESTARTING LOOP for version=${pending.version}")
                    logger.i("PlaylistExecutor", "Applying pending playlist: ${pending.playlistId}, version: ${pending.version}")
                    android.util.Log.d("PLAYER_FLOW", "PlaylistExecutor loop: Applying pendingPlaylist ID=${pending.playlistId}, version=${pending.version}")
                    pendingPlaylist = null
                    currentPlaylistId = pending.playlistId
                    currentPlaylistVersion = pending.version
                    playbackController.setCurrentPlaylistId(pending.playlistId)
                    startPlaylistLoop(pending)
                    android.util.Log.i("PlaylistTrace", "New playback loop launched")
                    break
                }
                
                currentIndex++
            }
        }
    }

    override suspend fun stop() {
        logger.i("PlaylistExecutor", "Stopping playlist execution.")
        android.util.Log.d("PLAYER_FLOW", "PlaylistExecutor.stop() called. Cancelling loopJob and calling playbackController.stop()")
        loopJob?.cancel()
        currentPlaylistId = null
        currentPlaylistVersion = null
        pendingPlaylist = null
        playbackController.stop()
    }
}
