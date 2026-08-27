package com.digitalsignage.player.core.storage

import android.content.Context
import com.digitalsignage.player.core.utils.FileValidator
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.mockito.Mockito.`when`
import org.mockito.Mockito.mock
import java.io.File
import java.nio.file.Files

class StorageManagerTest {

    private lateinit var tempDir: File
    private lateinit var storageManager: StorageManager
    private lateinit var mockContext: Context
    private lateinit var realFileValidator: FileValidator
    private lateinit var mediaDir: File

    @Before
    fun setup() {
        tempDir = Files.createTempDirectory("dms_storage_test").toFile()
        mockContext = mock(Context::class.java)
        realFileValidator = FileValidator()
        `when`(mockContext.filesDir).thenReturn(tempDir)
        storageManager = StorageManager(mockContext)
        mediaDir = storageManager.getMediaDirectory()
    }

    @After
    fun tearDown() {
        tempDir.deleteRecursively()
    }

    @Test
    fun `getCanonicalFileName formats mediaId and sanitized filename from URL`() {
        val url = "http://example.com/media/test_video.mp4?token=123"
        val canonicalName = storageManager.getCanonicalFileName("MEDIA-123", url)
        assertEquals("MEDIA-123_test_video.mp4", canonicalName)
    }

    @Test
    fun `getCanonicalFileName falls back to mediaId when URL is null or empty`() {
        assertEquals("MEDIA-123", storageManager.getCanonicalFileName("MEDIA-123", null))
        assertEquals("MEDIA-123", storageManager.getCanonicalFileName("MEDIA-123", ""))
    }

    @Test
    fun `resolveValidMediaFile resolves file via valid localFilePath`() {
        val validFile = File(mediaDir, "custom_path.mp4").apply {
            writeText("video data")
        }

        val resolved = storageManager.resolveValidMediaFile(
            mediaId = "M1",
            url = "http://example.com/video.mp4",
            localFilePath = validFile.absolutePath,
            expectedMd5 = null,
            expectedSha256 = null,
            expectedSize = null,
            fileValidator = realFileValidator
        )

        assertNotNull(resolved)
        assertEquals(validFile.absolutePath, resolved?.absolutePath)
    }

    @Test
    fun `resolveValidMediaFile recovers valid file via canonical filename when localFilePath is missing`() {
        val canonicalFile = File(mediaDir, "M1_video.mp4").apply {
            writeText("valid video data")
        }

        val resolved = storageManager.resolveValidMediaFile(
            mediaId = "M1",
            url = "http://example.com/video.mp4",
            localFilePath = null, // localFilePath missing
            expectedMd5 = null,
            expectedSha256 = null,
            expectedSize = null,
            fileValidator = realFileValidator
        )

        assertNotNull(resolved)
        assertEquals(canonicalFile.absolutePath, resolved?.absolutePath)
    }

    @Test
    fun `resolveValidMediaFile recovers valid file via prefix match when localFilePath points to non-existent location`() {
        val prefixFile = File(mediaDir, "M1_renamed_asset.mp4").apply {
            writeText("valid media content")
        }

        val resolved = storageManager.resolveValidMediaFile(
            mediaId = "M1",
            url = null,
            localFilePath = "/non/existent/path/M1.mp4",
            expectedMd5 = null,
            expectedSha256 = null,
            expectedSize = null,
            fileValidator = realFileValidator
        )

        assertNotNull(resolved)
        assertEquals(prefixFile.absolutePath, resolved?.absolutePath)
    }

    @Test
    fun `resolveValidMediaFile strictly ignores tmp files`() {
        File(mediaDir, "M1_video.mp4.tmp").apply {
            writeText("partial download")
        }

        val resolved = storageManager.resolveValidMediaFile(
            mediaId = "M1",
            url = "http://example.com/video.mp4",
            localFilePath = null,
            expectedMd5 = null,
            expectedSha256 = null,
            expectedSize = null,
            fileValidator = realFileValidator
        )

        assertNull(resolved)
    }

    @Test
    fun `resolveValidMediaFile returns null when candidate file fails checksum validation`() {
        File(mediaDir, "M1_video.mp4").apply {
            writeText("corrupt content")
        }

        val resolved = storageManager.resolveValidMediaFile(
            mediaId = "M1",
            url = "http://example.com/video.mp4",
            localFilePath = null,
            expectedMd5 = null,
            expectedSha256 = "invalid_expected_hash",
            expectedSize = null,
            fileValidator = realFileValidator
        )

        assertNull(resolved)
    }
}
