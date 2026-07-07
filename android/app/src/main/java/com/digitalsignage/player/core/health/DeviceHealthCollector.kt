package com.digitalsignage.player.core.health

import android.app.ActivityManager
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.os.SystemClock
import com.digitalsignage.player.BuildConfig
import com.digitalsignage.player.data.local.AppDatabase
import com.digitalsignage.player.domain.model.PlaylistState
import com.digitalsignage.player.domain.playback.PlaybackController
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DeviceHealthCollector @Inject constructor(
    @ApplicationContext private val context: Context,
    private val database: AppDatabase,
    private val playbackController: PlaybackController
) {

    suspend fun collectHealthData(installationId: String): com.digitalsignage.player.data.remote.dto.HeartbeatPayload {
        val activePlaylist = database.playlistDao().getPlaylistByState(PlaylistState.ACTIVE)
        val playbackStateStr = if (playbackController.isPlaying()) "PLAYING" else "IDLE"

        val stat = StatFs(Environment.getDataDirectory().path)
        val availableBytes = stat.availableBlocksLong * stat.blockSizeLong
        val totalBytes = stat.blockCountLong * stat.blockSizeLong

        val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val memoryInfo = ActivityManager.MemoryInfo()
        activityManager.getMemoryInfo(memoryInfo)

        val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = connectivityManager.activeNetwork
        val capabilities = connectivityManager.getNetworkCapabilities(network)
        val networkType = when {
            capabilities == null -> "OFFLINE"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ETHERNET"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "WIFI"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "CELLULAR"
            else -> "UNKNOWN"
        }

        val usedBytes = totalBytes - availableBytes

        return com.digitalsignage.player.data.remote.dto.HeartbeatPayload(
            deviceId = installationId, // This parameter is actually deviceId in HeartbeatRepositoryImpl
            storageUsed = usedBytes.toFloat() / (1024 * 1024),
            storageTotal = totalBytes.toFloat() / (1024 * 1024),
            currentPlaylistId = playbackController.getCurrentPlaylistId() ?: activePlaylist?.playlistId,
            currentMediaId = playbackController.getCurrentMediaId(),
            appVersion = "${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})",
            uptimeSeconds = SystemClock.elapsedRealtime() / 1000,
            ipAddress = null,
            firmwareVersion = Build.VERSION.RELEASE
        )
    }
}
