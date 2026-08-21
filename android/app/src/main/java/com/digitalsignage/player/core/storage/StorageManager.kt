package com.digitalsignage.player.core.storage

import android.content.Context
import android.os.Environment
import android.os.StatFs
import com.digitalsignage.player.core.utils.FileValidator
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class StorageManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val MIN_AVAILABLE_BYTES = 500L * 1024L * 1024L // 500MB
    
    fun getMediaDirectory(): File {
        val dir = File(context.filesDir, "media")
        if (!dir.exists()) dir.mkdirs()
        return dir
    }
    
    fun isStorageAvailable(requiredBytes: Long = 0): Boolean {
        val stat = StatFs(getMediaDirectory().path)
        val availableBytes = stat.availableBlocksLong * stat.blockSizeLong
        return (availableBytes - requiredBytes) > MIN_AVAILABLE_BYTES
    }

    /**
     * Canonical media filename generator. Single source of truth for media filenames.
     */
    fun getCanonicalFileName(mediaId: String, url: String?): String {
        return if (!url.isNullOrBlank()) {
            val nameFromUrl = url.substringAfterLast('/').substringBefore('?')
            val sanitized = nameFromUrl.replace("[\\\\/:*?\"<>|]".toRegex(), "_")
            "${mediaId}_$sanitized"
        } else {
            mediaId
        }
    }

    /**
     * Resolves and validates a candidate physical media file on disk.
     * Order of resolution:
     * 1. localFilePath (if specified)
     * 2. Canonical path in media directory (mediaId_sanitizedFilename)
     * 3. Direct mediaId filename in media directory
     * 4. Any non-tmp file in media directory starting with `${mediaId}_`
     *
     * Partial (.tmp) files are strictly ignored.
     * Candidates are validated using FileValidator (checking non-zero size, MD5/SHA256 checksum, and expected size).
     */
    fun resolveValidMediaFile(
        mediaId: String,
        url: String?,
        localFilePath: String?,
        expectedMd5: String?,
        expectedSha256: String?,
        expectedSize: Long? = null,
        fileValidator: FileValidator
    ): File? {
        val mediaDir = getMediaDirectory()
        val candidatePaths = mutableListOf<File>()

        // 1. Provided localFilePath
        if (!localFilePath.isNullOrBlank()) {
            candidatePaths.add(File(localFilePath))
        }

        // 2. Canonical URL-derived filename
        if (!url.isNullOrBlank()) {
            val canonicalName = getCanonicalFileName(mediaId, url)
            candidatePaths.add(File(mediaDir, canonicalName))
        }

        // 3. Direct mediaId filename
        candidatePaths.add(File(mediaDir, mediaId))

        // 4. Any prefix-matched file in media directory
        val mediaFiles = mediaDir.listFiles() ?: emptyArray()
        for (file in mediaFiles) {
            if (file.name.endsWith(".tmp")) continue
            if (file.name.startsWith("${mediaId}_") || file.name == mediaId) {
                if (candidatePaths.none { it.absolutePath == file.absolutePath }) {
                    candidatePaths.add(file)
                }
            }
        }

        // Validate candidates in order
        for (candidate in candidatePaths) {
            if (candidate.exists() && candidate.isFile && candidate.length() > 0 && !candidate.name.endsWith(".tmp")) {
                if (fileValidator.validateFile(candidate, expectedMd5, expectedSha256, expectedSize)) {
                    return candidate
                }
            }
        }

        return null
    }
    
    fun cleanupOrphans(activeMediaIds: List<String>) {
        val mediaDir = getMediaDirectory()
        val files = mediaDir.listFiles() ?: return
        
        for (file in files) {
            val fileName = file.name
            val hasActivePrefix = activeMediaIds.any { fileName.startsWith("${it}_") || fileName == it }
            if (!hasActivePrefix && !fileName.endsWith(".tmp")) {
                file.delete()
            }
        }
    }
    
    fun cleanupTempFiles() {
        val mediaDir = getMediaDirectory()
        mediaDir.listFiles()?.forEach { file ->
            if (file.name.endsWith(".tmp")) {
                file.delete()
            }
        }
    }
}

