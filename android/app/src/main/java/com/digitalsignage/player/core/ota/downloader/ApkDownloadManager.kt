package com.digitalsignage.player.core.ota.downloader

import android.content.Context
import android.util.Log
import com.digitalsignage.player.core.ota.model.OtaCheckResult
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
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
    private val okHttpClient: OkHttpClient
) {
    companion object {
        private const val TAG = "KioskTrace"
    }

    private val _downloadState = MutableStateFlow<DownloadState>(DownloadState.Idle)
    val downloadState: StateFlow<DownloadState> = _downloadState.asStateFlow()

    suspend fun download(update: OtaCheckResult.UpdateAvailable): Boolean = withContext(Dispatchers.IO) {
        _downloadState.value = DownloadState.Downloading
        Log.i(TAG, "[OTA] Download started: ${update.apkUrl}")

        val otaDir = File(context.getExternalFilesDir(null), "ota")
        if (!otaDir.exists()) {
            otaDir.mkdirs()
        }

        val finalFile = File(otaDir, "update.apk")
        val partFile = File(otaDir, "update.apk.part")

        // Clean up previous files
        if (finalFile.exists()) finalFile.delete()
        if (partFile.exists()) partFile.delete()

        val request = Request.Builder().url(update.apkUrl).build()

        try {
            okHttpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    val err = "Server returned code ${response.code}"
                    Log.e(TAG, "[OTA] Download failed: $err")
                    _downloadState.value = DownloadState.Failed(err)
                    return@withContext false
                }

                val body = response.body
                if (body == null) {
                    val err = "Empty response body"
                    Log.e(TAG, "[OTA] Download failed: $err")
                    _downloadState.value = DownloadState.Failed(err)
                    return@withContext false
                }

                val contentLength = body.contentLength()
                val inputStream = body.byteStream()
                val outputStream = FileOutputStream(partFile)
                val digest = MessageDigest.getInstance("SHA-256")
                val buffer = ByteArray(8192)
                var bytesRead: Int
                var totalBytesRead: Long = 0

                outputStream.use { out ->
                    while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                        out.write(buffer, 0, bytesRead)
                        digest.update(buffer, 0, bytesRead)
                        totalBytesRead += bytesRead

                        if (contentLength > 0) {
                            val percent = ((totalBytesRead * 100) / contentLength).toInt()
                            _downloadState.value = DownloadState.Progress(percent)
                            Log.d(TAG, "[OTA] Downloading progress: $percent%")
                        }
                    }
                }

                _downloadState.value = DownloadState.Verifying
                Log.i(TAG, "[OTA] Download finished. Verifying checksum...")

                // Calculate SHA-256
                val sha256Bytes = digest.digest()
                val calculatedChecksum = sha256Bytes.joinToString("") { "%02x".format(it) }

                Log.i(TAG, "[OTA] Expected: ${update.checksum}")
                Log.i(TAG, "[OTA] Calculated: $calculatedChecksum")

                if (calculatedChecksum.equals(update.checksum, ignoreCase = true)) {
                    if (partFile.renameTo(finalFile)) {
                        _downloadState.value = DownloadState.Completed
                        Log.i(TAG, "[OTA] Ready for installation")
                        return@withContext true
                    } else {
                        val err = "Failed to rename temp file to update.apk"
                        Log.e(TAG, "[OTA] $err")
                        _downloadState.value = DownloadState.Failed(err)
                        return@withContext false
                    }
                } else {
                    val err = "Checksum verification failed"
                    Log.e(TAG, "[OTA] $err")
                    partFile.delete()
                    _downloadState.value = DownloadState.Failed(err)
                    return@withContext false
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "[OTA] Exception during download: ${e.message}", e)
            if (partFile.exists()) partFile.delete()
            _downloadState.value = DownloadState.Failed(e.message ?: "Unknown error")
            return@withContext false
        }
    }
}
