package com.digitalsignage.player.core.recovery

import android.content.Context
import com.digitalsignage.player.core.event.PlayerEventBus
import com.digitalsignage.player.core.logging.Logger
import com.digitalsignage.player.core.storage.StorageManager
import com.digitalsignage.player.core.utils.FileValidator
import com.digitalsignage.player.data.local.AppDatabase
import com.digitalsignage.player.data.local.MediaItemEntity
import com.digitalsignage.player.data.local.PlaylistEntity
import com.digitalsignage.player.domain.model.PlaylistState
import com.digitalsignage.player.workers.download.DownloadManager
import com.digitalsignage.player.workers.download.FakeDownloadSessionDao
import com.digitalsignage.player.workers.download.FakePlaylistDao
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito.`when`
import org.mockito.Mockito.mock
import java.io.File
import java.nio.file.Files

@OptIn(ExperimentalCoroutinesApi::class)
class StartupValidatorTest {

    private lateinit var tempDir: File
    private lateinit var storageManager: StorageManager
    private lateinit var realFileValidator: FileValidator
    private lateinit var validator: StartupValidator
    private lateinit var fakeDatabase: AppDatabase
    private lateinit var fakePlaylistDao: FakePlaylistDao
    private lateinit var fakeDownloadSessionDao: FakeDownloadSessionDao
    private lateinit var mockDownloadManager: DownloadManager
    private lateinit var mockEventBus: PlayerEventBus
    private lateinit var mockLogger: Logger

    @Before
    fun setup() {
        tempDir = Files.createTempDirectory("dms_sv_test").toFile()
        val mockContext = mock(Context::class.java)
        `when`(mockContext.filesDir).thenReturn(tempDir)
        storageManager = StorageManager(mockContext)
        realFileValidator = FileValidator()

        fakePlaylistDao = FakePlaylistDao()
        fakeDownloadSessionDao = FakeDownloadSessionDao()
        fakeDatabase = mock(AppDatabase::class.java)
        `when`(fakeDatabase.playlistDao()).thenReturn(fakePlaylistDao)
        `when`(fakeDatabase.downloadSessionDao()).thenReturn(fakeDownloadSessionDao)

        mockDownloadManager = mock(DownloadManager::class.java)
        mockEventBus = mock(PlayerEventBus::class.java)
        mockLogger = mock(Logger::class.java)

        validator = StartupValidator(
            database = fakeDatabase,
            storageManager = storageManager,
            fileValidator = realFileValidator,
            downloadManager = mockDownloadManager,
            eventBus = mockEventBus,
            logger = mockLogger
        )
    }

    @After
    fun tearDown() {
        tempDir.deleteRecursively()
    }

    @Test
    fun `validateAndRecover restores DB state when physical file exists despite missing localFilePath`() = runTest {
        val mediaDir = storageManager.getMediaDirectory()
        val existingFile = File(mediaDir, "M1_video.mp4").apply {
            writeText("video payload data")
        }

        val activePlaylist = PlaylistEntity("P1", 1L, PlaylistState.ACTIVE, System.currentTimeMillis())
        val mediaItem = MediaItemEntity(
            mediaId = "M1",
            playlistId = "P1",
            url = "http://example.com/video.mp4",
            durationMs = 5000L,
            displayOrder = 0,
            md5Hash = null,
            sha256Hash = null,
            mediaType = "VIDEO",
            isDownloaded = false, // Room says missing
            localFilePath = null  // localFilePath missing
        )

        fakePlaylistDao.activePlaylist = activePlaylist
        fakePlaylistDao.mediaItems.add(mediaItem)

        validator.validateAndRecover()

        // DB state restored to isDownloaded = true and localFilePath = existingFile.absolutePath
        assertTrue(fakePlaylistDao.updatedMediaState.any { it.first == "M1" && it.second && it.third == existingFile.absolutePath })
        // Playlist remains ACTIVE, never inserted as PENDING
        assertNull(fakePlaylistDao.insertedPlaylist)
    }

    @Test
    fun `validateAndRecover reverts playlist to PENDING when physical file is corrupted or missing`() = runTest {
        val activePlaylist = PlaylistEntity("P1", 1L, PlaylistState.ACTIVE, System.currentTimeMillis())
        val mediaItem = MediaItemEntity(
            mediaId = "M1",
            playlistId = "P1",
            url = "http://example.com/video.mp4",
            durationMs = 5000L,
            displayOrder = 0,
            md5Hash = null,
            sha256Hash = "hash123",
            mediaType = "VIDEO",
            isDownloaded = true,
            localFilePath = "/non/existent/path/M1.mp4"
        )

        fakePlaylistDao.activePlaylist = activePlaylist
        fakePlaylistDao.mediaItems.add(mediaItem)

        validator.validateAndRecover()

        // Marked isDownloaded = false
        assertTrue(fakePlaylistDao.updatedMediaState.any { it.first == "M1" && !it.second })
        // Playlist reverted to PENDING
        assertEquals(PlaylistState.PENDING, fakePlaylistDao.insertedPlaylist?.state)
    }
}
