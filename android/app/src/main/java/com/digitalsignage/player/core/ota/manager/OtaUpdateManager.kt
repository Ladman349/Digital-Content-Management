package com.digitalsignage.player.core.ota.manager

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import com.digitalsignage.player.core.ota.api.OtaRepository
import com.digitalsignage.player.core.ota.model.OtaCheckResult
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.withTimeoutOrNull
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class OtaUpdateManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val otaRepository: OtaRepository
) {
    companion object {
        private const val TAG = "KioskTrace"
        private const val OTA_CHECK_TIMEOUT_MS = 5_000L
    }

    private fun getCurrentVersionCode(): Long {
        val pm = context.packageManager
        val packageName = context.packageName
        return try {
            val pInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                pm.getPackageInfo(packageName, PackageManager.PackageInfoFlags.of(0))
            } else {
                @Suppress("DEPRECATION")
                pm.getPackageInfo(packageName, 0)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                pInfo.longVersionCode
            } else {
                @Suppress("DEPRECATION")
                pInfo.versionCode.toLong()
            }
        } catch (e: Exception) {
            Log.e(TAG, "[OTA] Failed to get current version code", e)
            1L
        }
    }

    suspend fun checkForUpdates(): OtaCheckResult {
        val currentCode = getCurrentVersionCode()
        
        return withTimeoutOrNull(OTA_CHECK_TIMEOUT_MS) {
            try {
                // Convert Long to Int for API query
                val response = otaRepository.checkForUpdate(currentCode.toInt())
                if (response.isSuccessful) {
                    val dto = response.body()
                    if (dto != null) {
                        if (dto.updateAvailable && dto.latestVersionCode != null) {
                            OtaCheckResult.UpdateAvailable(
                                currentVersionCode = currentCode.toInt(),
                                latestVersionCode = dto.latestVersionCode,
                                versionName = dto.versionName ?: "",
                                apkUrl = dto.apkUrl ?: "",
                                checksum = dto.checksum ?: "",
                                fileSize = dto.fileSize ?: 0L,
                                mandatory = dto.mandatory ?: false,
                                releaseNotes = dto.releaseNotes
                            )
                        } else {
                            OtaCheckResult.NoUpdate
                        }
                    } else {
                        OtaCheckResult.Failure("Empty response body from server")
                    }
                } else {
                    OtaCheckResult.Failure("HTTP ${response.code()}: ${response.message()}")
                }
            } catch (e: java.io.IOException) {
                // Expected network connectivity warnings
                OtaCheckResult.Failure("Network unavailable: ${e.message}", e)
            } catch (e: Exception) {
                OtaCheckResult.Failure("Malformed server response or error: ${e.message}", e)
            }
        } ?: OtaCheckResult.Failure("Update check timed out after ${OTA_CHECK_TIMEOUT_MS / 1000}s")
    }
}
