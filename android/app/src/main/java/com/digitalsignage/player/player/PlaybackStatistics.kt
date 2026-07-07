package com.digitalsignage.player.player

/**
 * Tracks playback statistics.
 * Owned by PlaybackController.
 */
data class PlaybackStatistics(
    var currentMediaId: String? = null,
    var currentPlaylistId: String? = null,
    var completedItems: Int = 0,
    var skippedItems: Int = 0,
    var playbackErrors: Int = 0,
    var playbackStartTime: Long = 0,
    var sessionId: String? = null,
    var averagePlaybackLatency: Long = 0L,
    var lastMediaCompletedAt: Long = 0L,
    var lastHeartbeatAt: Long = 0L,
    var averageImageLoadTime: Long = 0L,
    var averageVideoStartupTime: Long = 0L,
    var lastPlaylistSyncTime: Long = 0L,
    var heartbeatSuccessRate: Float = 100f,
    var consecutivePlaybackFailures: Int = 0,
    var lastSuccessfulPlayback: Long = 0L
)
