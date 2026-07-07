package com.digitalsignage.player.player

data class PerformanceMetrics(
    var averageMediaLoadTimeMs: Long = 0,
    var averagePlaylistSyncTimeMs: Long = 0,
    var averageHeartbeatDurationMs: Long = 0,
    var cacheCleanupDurationMs: Long = 0,
    var applicationStartupDurationMs: Long = 0,
    var memoryUsageMb: Float = 0f,
    var cpuUsagePercent: Float = 0f
)
