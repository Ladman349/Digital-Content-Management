package com.digitalsignage.player.domain.playback.executor

import com.digitalsignage.player.core.event.PlayerEventBus
import com.digitalsignage.player.core.logging.Logger
import com.digitalsignage.player.domain.model.Playlist
import com.digitalsignage.player.domain.model.PlaylistState
import com.digitalsignage.player.domain.playback.PlaybackEngine
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify

@OptIn(ExperimentalCoroutinesApi::class)
class PlaylistExecutorTest {

    private lateinit var executor: PlaylistExecutorImpl
    private lateinit var engine: PlaybackEngine
    private lateinit var eventBus: PlayerEventBus
    private lateinit var logger: Logger

    @Before
    fun setup() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        engine = mock(PlaybackEngine::class.java)
        eventBus = mock(PlayerEventBus::class.java)
        logger = mock(Logger::class.java)
        executor = PlaylistExecutorImpl(engine, eventBus, logger)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `execute sets playlist on engine when called`() = runTest {
        val playlist = Playlist(
            playlistId = "p1",
            version = 1,
            state = PlaylistState.ACTIVE,
            items = emptyList()
        )
        executor.execute(playlist)
        verify(engine).setPlaylist(playlist)
    }
}
