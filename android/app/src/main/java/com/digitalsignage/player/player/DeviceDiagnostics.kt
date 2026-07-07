package com.digitalsignage.player.player

data class DeviceDiagnostics(
    val manufacturer: String,
    val model: String,
    val androidVersion: String,
    val appVersion: String,
    val deviceId: String,
    val currentPlaylist: String?,
    val currentMedia: String?,
    val playbackState: String,
    val offlineState: String,
    val cacheUsagePercent: Float,
    val storageUsageMb: Float,
    val lastPlaylistSync: Long,
    val lastHeartbeat: Long
)
