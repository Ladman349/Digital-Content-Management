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
    // Left free once a download has finished, so the system and this app's own databases never
    // hit zero. It used to be a flat 500 MB whatever the download needed, which a TV with a 4 GB
    // data partition can rarely spare: such a screen refused every download and sat on
    // "Downloading" for ever.
    val reserveBytes = 50L * 1024L * 1024L

    /** Replaced in unit tests, where StatFs is not available. */
    internal var freeBytesProvider: () -> Long = {
        val stat = StatFs(getMediaDirectory().path)
        stat.availableBlocksLong * stat.blockSizeLong
    }
    
    fun getMediaDirectory(): File {
        val dir = File(context.filesDir, "media")
        if (!dir.exists()) dir.mkdirs()
        return dir
    }
    
    fun availableBytes(): Long = freeBytesProvider()

    /** True when [requiredBytes] can be written and the reserve is still free afterwards. */
    fun isStorageAvailable(requiredBytes: Long = 0): Boolean =
        availableBytes() - requiredBytes.coerceAtLeast(0L) >= reserveBytes

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

        // 4. Prefix scan: any non-tmp file named "<mediaId>_*". Recovers assets whose recorded
        //    localFilePath is stale (app data moved, file renamed) without re-downloading them.
        //    Sorted so the choice is deterministic when several candidates match.
        mediaDir.listFiles()
            ?.filter { it.isFile && !it.name.endsWith(".tmp") && it.name.startsWith("${mediaId}_") }
            ?.sortedBy { it.name }
            ?.forEach { match ->
                if (candidatePaths.none { it.absolutePath == match.absolutePath }) {
                    candidatePaths.add(match)
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

