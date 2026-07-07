package com.digitalsignage.player.player

/**
 * Immutable snapshot of the current runtime state.
 * Created by PlaybackController for the HeartbeatWorker to consume safely.
 */
data class RuntimeSnapshot(
    val playerState: String,
    val currentPlaylistId: String?,
    val currentPlaylistVersion: Long,
    val currentMediaId: String?,
    val completedItems: Int,
    val skippedItems: Int,
    val playbackErrors: Int,
    val sessionId: String?,
    val averagePlaybackLatency: Long,
    val lastMediaCompletedAt: Long,
    val lastHeartbeatAt: Long,
    val averageImageLoadTime: Long,
    val averageVideoStartupTime: Long,
    val lastPlaylistSyncTime: Long,
    val heartbeatSuccessRate: Float,
    val consecutivePlaybackFailures: Int,
    val lastSuccessfulPlayback: Long
)
