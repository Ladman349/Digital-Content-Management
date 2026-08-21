package com.digitalsignage.player.workers.download

import android.content.Context
import com.digitalsignage.player.core.event.PlayerEventBus
import com.digitalsignage.player.core.logging.Logger
import com.digitalsignage.player.core.storage.StorageManager
import com.digitalsignage.player.core.utils.FileValidator
import com.digitalsignage.player.data.local.AppDatabase
import com.digitalsignage.player.data.local.DownloadSessionDao
import com.digitalsignage.player.data.local.DownloadSessionEntity
import com.digitalsignage.player.data.local.MediaItemEntity
import com.digitalsignage.player.data.local.PlaylistDao
import com.digitalsignage.player.data.local.PlaylistEntity
import com.digitalsignage.player.domain.model.DownloadState
import com.digitalsignage.player.domain.model.PlaylistState
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import java.io.File
import java.nio.file.Files

class FakePlaylistDao : PlaylistDao {
    val updatedMediaState = mutableListOf<Triple<String, Boolean, String>>()
    var insertedPlaylist: PlaylistEntity? = null
    var activePlaylist: PlaylistEntity? = null
    var mediaItems = mutableListOf<MediaItemEntity>()

    override suspend fun insertPlaylist(playlist: PlaylistEntity) { insertedPlaylist = playlist }
    override suspend fun getPlaylistByState(state: PlaylistState): PlaylistEntity? = if (state == PlaylistState.ACTIVE) activePlaylist else null
    override fun observeActivePlaylist(): Flow<PlaylistEntity?> = flowOf(activePlaylist)
    override suspend fun insertMediaItems(items: List<MediaItemEntity>) { mediaItems.addAll(items) }
    override suspend fun getMediaItemsForPlaylist(playlistId: String): List<MediaItemEntity> = mediaItems.filter { it.playlistId == playlistId }
    override suspend fun archiveActivePlaylist() {}
    override suspend fun activatePendingPlaylist(playlistId: String) {}
    override suspend fun updateMediaDownloadedState(mediaId: String, isDownloaded: Boolean, filePath: String) {
        updatedMediaState.add(Triple(mediaId, isDownloaded, filePath))
    }
    override suspend fun countIncompleteMediaItems(playlistId: String): Int = 0
    override suspend fun deletePlaylistById(playlistId: String) {}
    override suspend fun deleteMediaItemsForPlaylist(playlistId: String) {}
}

class FakeDownloadSessionDao : DownloadSessionDao {
    val updatedStates = mutableListOf<Triple<String, DownloadState, Long>>()
    val pendingTasks = mutableListOf<DownloadSessionEntity>()

    override suspend fun insertTasks(tasks: List<DownloadSessionEntity>) { pendingTasks.addAll(tasks) }
    override suspend fun getPendingTasks(): List<DownloadSessionEntity> = pendingTasks
    override suspend fun updateSessionOffset(mediaId: String, offset: Long, updatedAt: Long) {}
    override suspend fun updateSessionState(mediaId: String, state: DownloadState, updatedAt: Long) {
        updatedStates.add(Triple(mediaId, state, updatedAt))
    }
    override suspend fun incrementRetryCount(mediaId: String, count: Int, updatedAt: Long) {}
}

@OptIn(ExperimentalCoroutinesApi::class)
class DownloadManagerTest {

    private lateinit var tempDir: File
    private lateinit var storageManager: StorageManager
    private lateinit var realFileValidator: FileValidator
    private lateinit var downloadManager: DownloadManager
    private lateinit var fakeDatabase: AppDatabase
    private lateinit var fakeDownloadSessionDao: FakeDownloadSessionDao
    private lateinit var fakePlaylistDao: FakePlaylistDao
    private lateinit var mockEventBus: PlayerEventBus
    private lateinit var mockLogger: Logger
    private lateinit var mockHttpClient: OkHttpClient

    @Before
    fun setup() {
        tempDir = Files.createTempDirectory("dms_dm_test").toFile()
        val mockContext = mock(Context::class.java)
        `when`(mockContext.filesDir).thenReturn(tempDir)
        storageManager = StorageManager(mockContext)
        realFileValidator = FileValidator()

        fakeDownloadSessionDao = FakeDownloadSessionDao()
        fakePlaylistDao = FakePlaylistDao()
        fakeDatabase = mock(AppDatabase::class.java)
        `when`(fakeDatabase.downloadSessionDao()).thenReturn(fakeDownloadSessionDao)
        `when`(fakeDatabase.playlistDao()).thenReturn(fakePlaylistDao)

        mockEventBus = mock(PlayerEventBus::class.java)
        mockLogger = mock(Logger::class.java)
        mockHttpClient = mock(OkHttpClient::class.java)

        downloadManager = DownloadManager(
            database = fakeDatabase,
            storageManager = storageManager,
            fileValidator = realFileValidator,
            eventBus = mockEventBus,
            logger = mockLogger,
            client = mockHttpClient
        )
    }

    @After
    fun tearDown() {
        tempDir.deleteRecursively()
    }

    @Test
    fun `attemptDownload pre-flight check skips network request when valid file exists`() = runTest {
        val mediaDir = storageManager.getMediaDirectory()
        val existingFile = File(mediaDir, "M1_video.mp4").apply {
            writeText("video test data")
        }

        val session = DownloadSessionEntity(
            mediaId = "M1",
            url = "http://example.com/video.mp4",
            downloadState = DownloadState.QUEUED,
            currentByteOffset = 0L,
            expectedSize = existingFile.length(),
            expectedChecksumMd5 = null,
            expectedChecksumSha256 = null,
            retryCount = 0,
            priority = 10,
            destinationPath = existingFile.absolutePath,
            createdAt = System.currentTimeMillis(),
            updatedAt = System.currentTimeMillis()
        )

        downloadManager.attemptDownload(session)

        // Verify DB updated to COMPLETED and media item isDownloaded set to true
        assertTrue(fakeDownloadSessionDao.updatedStates.any { it.first == "M1" && it.second == DownloadState.COMPLETED })
        assertTrue(fakePlaylistDao.updatedMediaState.any { it.first == "M1" && it.second && it.third == existingFile.absolutePath })
    }

    @Test
    fun `attemptDownload transitions session state to FAILED when max retries reached`() = runTest {
        val session = DownloadSessionEntity(
            mediaId = "M1",
            url = "http://example.com/video.mp4",
            downloadState = DownloadState.QUEUED,
            currentByteOffset = 0L,
            expectedSize = 1000L,
            expectedChecksumMd5 = null,
            expectedChecksumSha256 = "hash123",
            retryCount = 5, // max retries reached
            priority = 10,
            destinationPath = "",
            createdAt = System.currentTimeMillis(),
            updatedAt = System.currentTimeMillis()
        )

        downloadManager.attemptDownload(session)

        assertTrue(fakeDownloadSessionDao.updatedStates.any { it.first == "M1" && it.second == DownloadState.FAILED })
    }
}
