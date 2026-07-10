package com.digitalsignage.player.domain.playback.executor

import com.digitalsignage.player.core.event.PlayerEventBus
import com.digitalsignage.player.core.logging.Logger
import com.digitalsignage.player.domain.model.Playlist
import com.digitalsignage.player.domain.model.PlaylistState
import com.digitalsignage.player.domain.model.MediaItem
import com.digitalsignage.player.domain.model.MediaType
import com.digitalsignage.player.domain.playback.PlaybackController
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.coroutines.test.runCurrent
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.junit.Assert.assertTrue
import org.junit.Assert.assertEquals
import org.mockito.Mockito.mock

class FakePlaybackController : PlaybackController {
    var initializeCalled = false
    var stopCalled = false
    private var _currentPlaylistId: String? = null
    var isPlayingVal = false
    val playedItems = mutableListOf<MediaItem>()

    override fun initialize() {
        initializeCalled = true
    }

    override suspend fun playItem(item: MediaItem) {
        playedItems.add(item)
        kotlinx.coroutines.delay(100) // Yields and suspends execution to avoid infinite tight loops
    }

    override fun stop() {
        stopCalled = true
    }

    override fun release() {}

    override fun isPlaying(): Boolean = isPlayingVal

    override fun getCurrentMediaId(): String? = playedItems.lastOrNull()?.mediaId

    override fun getCurrentPlaylistId(): String? = _currentPlaylistId

    override fun setCurrentPlaylistId(playlistId: String?) {
        _currentPlaylistId = playlistId
    }

    fun getSavedPlaylistId(): String? = _currentPlaylistId
}

@OptIn(ExperimentalCoroutinesApi::class)
class PlaylistExecutorTest {

    private lateinit var executor: PlaylistExecutorImpl
    private lateinit var playbackController: FakePlaybackController
    private lateinit var eventBus: PlayerEventBus
    private lateinit var logger: Logger

    @Before
    fun setup() {
        Dispatchers.setMain(StandardTestDispatcher())
        playbackController = FakePlaybackController()
        eventBus = mock(PlayerEventBus::class.java)
        logger = mock(Logger::class.java)
        executor = PlaylistExecutorImpl(playbackController, eventBus, logger)
    }

    @After
    fun tearDown() {
        executor.stop()
        Dispatchers.resetMain()
    }

    @Test
    fun `execute with empty playlist calls stop on controller`() = runTest {
        val playlist = Playlist(
            playlistId = "p1",
            version = 1,
            state = PlaylistState.ACTIVE,
            items = emptyList()
        )
        executor.execute(playlist)
        runCurrent()
        assertTrue(playbackController.stopCalled)
        executor.stop()
    }

    @Test
    fun `execute with items initializes controller and sets current playlist ID`() = runTest {
        val items = listOf(
            MediaItem(
                mediaId = "m1",
                url = "http://example.com/m1",
                durationMs = 5000L,
                order = 0,
                md5Hash = "abc",
                sha256Hash = "def",
                mediaType = MediaType.IMAGE,
                isDownloaded = true
            )
        )
        val playlist = Playlist(
            playlistId = "p1",
            version = 1,
            state = PlaylistState.ACTIVE,
            items = items
        )
        executor.execute(playlist)
        runCurrent()
        assertTrue(playbackController.initializeCalled)
        assertEquals("p1", playbackController.getSavedPlaylistId())
        executor.stop() // Crucial: Stop the executor loop to prevent infinite runTest cleanup loops
    }
}
