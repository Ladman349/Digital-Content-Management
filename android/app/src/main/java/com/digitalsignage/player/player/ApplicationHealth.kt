package com.digitalsignage.player.player

enum class ApplicationHealth {
    HEALTHY,
    WARNING,
    CRITICAL;
    
    companion object {
        fun determineHealth(
            crashCount: Int,
            consecutivePlaybackFailures: Int,
            consecutiveHeartbeatFailures: Int,
            cacheCorruptionCount: Int,
            freeStorageMb: Float
        ): ApplicationHealth {
            if (crashCount >= 3 || consecutivePlaybackFailures >= 10 || freeStorageMb < 50f) {
                return CRITICAL
            }
            if (crashCount > 0 || consecutivePlaybackFailures > 0 || consecutiveHeartbeatFailures >= 3 || cacheCorruptionCount > 0 || freeStorageMb < 200f) {
                return WARNING
            }
            return HEALTHY
        }
    }
}
