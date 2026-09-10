package com.digitalsignage.player.core.ota.downloader

import android.content.Context
import android.util.Log
import com.digitalsignage.player.core.ota.model.OtaCheckResult
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ApkDownloadManager @Inject constructor(
    @ApplicationContext private val context: Context,
    @javax.inject.Named("download") private val okHttpClient: OkHttpClient
) {
    companion object {
        private const val TAG = "KioskTrace"

        /** Total network attempts for one download request. */
        private const val MAX_ATTEMPTS = 3

        /** Backoff before retry N (2s, 4s, 8s). */
        private val BACKOFF_MS = longArrayOf(2_000L, 4_000L, 8_000L)

        /**
         * A corrupted transfer is worth exactly one more try; beyond that the server artifact or
         * the advertised checksum is wrong and retrying only burns bandwidth.
         */
        private const val MAX_CHECKSUM_MISMATCHES = 2

        const val APK_FILE_NAME = "update.apk"
        const val PART_FILE_NAME = "update.apk.part"
        const val METADATA_FILE_NAME = "metadata.json"
    }

    private val _downloadState = MutableStateFlow<DownloadState>(DownloadState.Idle)
    val downloadState: StateFlow<DownloadState> = _downloadState.asStateFlow()

    /** Outcome of a single network attempt, used to decide whether a retry is worthwhile. */
    private sealed interface AttemptOutcome {
        object Success : AttemptOutcome
        /** Transport-level problem (I/O, 5xx, truncated body): safe to retry. */
        data class Retryable(val reason: String) : AttemptOutcome
        /** Bytes arrived but did not hash to the advertised checksum. */
        data class ChecksumMismatch(val reason: String) : AttemptOutcome
        /** Server said "no" in a way that will not change (4xx) or the local file system failed. */
        data class Fatal(val reason: String) : AttemptOutcome
    }

    private fun otaDir(): File {
        val dir = File(context.getExternalFilesDir(null), "ota")
        if (!dir.exists()) dir.mkdirs()
        return dir
    }

    fun apkFile(): File = File(otaDir(), APK_FILE_NAME)

    fun metadataFile(): File = File(otaDir(), METADATA_FILE_NAME)

    /**
     * Downloads and verifies the APK, retrying the *network* portion with exponential backoff.
     * Returns true when [APK_FILE_NAME] is staged and its SHA-256 matches [update].
     */
    suspend fun download(update: OtaCheckResult.UpdateAvailable): Boolean = withContext(Dispatchers.IO) {
        _downloadState.value = DownloadState.Downloading
        Log.i(TAG, "[OTA] Download started: ${update.apkUrl}")

        val finalFile = apkFile()
        val partFile = File(otaDir(), PART_FILE_NAME)

        // Pre-check: If finalFile exists, verify its checksum to avoid duplicate downloads
        if (finalFile.exists()) {
            _downloadState.value = DownloadState.Verifying
            Log.i(TAG, "[OTA] Checking existing local update.apk...")
            val existingChecksum = calculateFileSha256(finalFile)
            if (existingChecksum.equals(update.checksum, ignoreCase = true)) {
                writeMetadataJson(update)
                _downloadState.value = DownloadState.ReadyForInstall
                Log.i(TAG, "[OTA] Local update.apk is up-to-date. Skipping download. Ready for installation")
                return@withContext true
            } else {
                Log.i(TAG, "[OTA] Existing update.apk checksum mismatch. Deleting and re-downloading...")
                finalFile.delete()
            }
        }

        var checksumMismatches = 0
        var lastReason = "Unknown error"

        for (attempt in 1..MAX_ATTEMPTS) {
            if (partFile.exists()) partFile.delete()

            if (attempt > 1) {
                val backoff = BACKOFF_MS[(attempt - 2).coerceIn(0, BACKOFF_MS.size - 1)]
                Log.w(TAG, "[OTA] Retrying download in ${backoff}ms (attempt $attempt/$MAX_ATTEMPTS)")
                delay(backoff)
                _downloadState.value = DownloadState.Downloading
            }

            when (val outcome = attemptDownload(update, partFile, finalFile)) {
                is AttemptOutcome.Success -> {
                    _downloadState.value = DownloadState.ReadyForInstall
                    Log.i(TAG, "[OTA] Ready for installation")
                    return@withContext true
                }
                is AttemptOutcome.Fatal -> {
                    Log.e(TAG, "[OTA] Download failed permanently: ${outcome.reason}")
                    _downloadState.value = DownloadState.Failed(outcome.reason)
                    return@withContext false
                }
                is AttemptOutcome.ChecksumMismatch -> {
                    checksumMismatches++
                    lastReason = outcome.reason
                    if (checksumMismatches >= MAX_CHECKSUM_MISMATCHES) {
                        Log.e(TAG, "[OTA] Checksum mismatch $checksumMismatches time(s); giving up.")
                        _downloadState.value = DownloadState.Failed(lastReason)
                        return@withContext false
                    }
                    Log.w(TAG, "[OTA] Checksum mismatch; one more attempt will be made.")
                }
                is AttemptOutcome.Retryable -> {
                    lastReason = outcome.reason
                    Log.w(TAG, "[OTA] Download attempt $attempt failed: $lastReason")
                }
            }
        }

        Log.e(TAG, "[OTA] Download failed after $MAX_ATTEMPTS attempts: $lastReason")
        _downloadState.value = DownloadState.Failed(lastReason)
        false
    }

    private fun attemptDownload(
        update: OtaCheckResult.UpdateAvailable,
        partFile: File,
        finalFile: File
    ): AttemptOutcome {
        // OkHttp follows the backend's 307 redirect to object storage transparently; the checksum
        // below is computed over the bytes actually received, wherever they came from.
        val request = Request.Builder().url(update.apkUrl).build()

        try {
            okHttpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    val err = "Server returned code ${response.code}"
                    // 4xx is a bad/expired URL: a retry cannot fix it. 5xx and the rest can.
                    return if (response.code in 400..499) {
                        AttemptOutcome.Fatal(err)
                    } else {
                        AttemptOutcome.Retryable(err)
                    }
                }

                val body = response.body ?: return AttemptOutcome.Retryable("Empty response body")

                val contentLength = body.contentLength()
                val inputStream = body.byteStream()
                val outputStream = FileOutputStream(partFile)
                val digest = MessageDigest.getInstance("SHA-256")
                val buffer = ByteArray(8192)
                var bytesRead: Int
                var totalBytesRead: Long = 0
                var lastLoggedPercent = -1

                outputStream.use { out ->
                    while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                        out.write(buffer, 0, bytesRead)
                        digest.update(buffer, 0, bytesRead)
                        totalBytesRead += bytesRead

                        if (contentLength > 0) {
                            val percent = ((totalBytesRead * 100) / contentLength).toInt()
                            if (percent != lastLoggedPercent) {
                                lastLoggedPercent = percent
                                _downloadState.value = DownloadState.Progress(percent)
                                Log.d(TAG, "[OTA] Downloading progress: $percent%")
                            }
                        }
                    }
                }

                _downloadState.value = DownloadState.Verifying
                Log.i(TAG, "[OTA] Download finished. Verifying checksum...")

                val sha256Bytes = digest.digest()
                val calculatedChecksum = sha256Bytes.joinToString("") { "%02x".format(it) }

                Log.i(TAG, "[OTA] Expected: ${update.checksum}")
                Log.i(TAG, "[OTA] Calculated: $calculatedChecksum")

                if (!calculatedChecksum.equals(update.checksum, ignoreCase = true)) {
                    partFile.delete()
                    return AttemptOutcome.ChecksumMismatch("Checksum verification failed")
                }

                if (!partFile.renameTo(finalFile)) {
                    return AttemptOutcome.Fatal("Failed to rename temp file to $APK_FILE_NAME")
                }

                writeMetadataJson(update)
                return AttemptOutcome.Success
            }
        } catch (e: Exception) {
            Log.w(TAG, "[OTA] Exception during download: ${e.message}", e)
            if (partFile.exists()) partFile.delete()
            return AttemptOutcome.Retryable(e.message ?: "Unknown error")
        }
    }

    /**
     * Version code recorded in metadata.json for the currently staged APK, or null when nothing is
     * staged / the file is unreadable.
     */
    fun stagedVersionCode(): Int? {
        val metadataFile = metadataFile()
        if (!metadataFile.exists()) return null
        return try {
            val json = org.json.JSONObject(metadataFile.readText())
            if (json.has("versionCode")) json.getInt("versionCode") else null
        } catch (e: Exception) {
            Log.w(TAG, "[OTA] Failed to read staged metadata.json: ${e.message}")
            null
        }
    }

    /**
     * Removes the staged update.apk, its partial file and metadata.json. Called after a successful
     * install (and at startup when the running version already covers the staged one) so that the
     * checksum short-circuit above cannot keep re-announcing a stale APK as "ready".
     */
    fun clearStagedUpdate() {
        val dir = File(context.getExternalFilesDir(null), "ota")
        var removed = 0
        listOf(APK_FILE_NAME, PART_FILE_NAME, METADATA_FILE_NAME).forEach { name ->
            val file = File(dir, name)
            if (file.exists() && file.delete()) removed++
        }
        if (removed > 0) {
            Log.i(TAG, "[OTA] Cleaned up $removed staged update file(s)")
        }
        _downloadState.value = DownloadState.Idle
    }

    private fun writeMetadataJson(update: OtaCheckResult.UpdateAvailable) {
        try {
            val metadataFile = File(otaDir(), METADATA_FILE_NAME)
            val format = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssZ", java.util.Locale.US)
            val metadataJson = org.json.JSONObject().apply {
                put("versionCode", update.latestVersionCode)
                put("versionName", update.versionName)
                put("checksum", update.checksum)
                put("downloadedAt", format.format(java.util.Date()))
                put("mandatory", update.mandatory)
                put("releaseNotes", update.releaseNotes ?: "")
                put("apkSize", update.fileSize)
            }
            metadataFile.writeText(metadataJson.toString(4))
            Log.i(TAG, "[OTA] Metadata JSON written: ${metadataFile.absolutePath}")
        } catch (e: Exception) {
            Log.e(TAG, "[OTA] Failed to write metadata.json", e)
        }
    }

    private fun calculateFileSha256(file: File): String {
        return try {
            val digest = MessageDigest.getInstance("SHA-256")
            file.inputStream().use { input ->
                val buffer = ByteArray(8192)
                var bytesRead: Int
                while (input.read(buffer).also { bytesRead = it } != -1) {
                    digest.update(buffer, 0, bytesRead)
                }
            }
            digest.digest().joinToString("") { "%02x".format(it) }
        } catch (e: Exception) {
            Log.e(TAG, "[OTA] Failed to calculate SHA-256 for ${file.name}", e)
            ""
        }
    }
}
