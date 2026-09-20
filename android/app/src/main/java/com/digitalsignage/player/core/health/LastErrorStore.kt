package com.digitalsignage.player.core.health

/**
 * The most recent error the player logged, reported with the heartbeat so that "why is that screen
 * blank?" can be answered from the CMS instead of from a ladder.
 *
 * Process-wide and in memory: it is a hint, not a record. Trouble reaching the server is left out,
 * because a screen can only report it once the trouble is over, when it would hide whatever real
 * error came before it.
 */
object LastErrorStore {
    private const val MAX_LENGTH = 300
    private val NETWORK_TAGS = setOf("HeartbeatRepository", "HeartbeatManager", "NetworkMonitor")

    @Volatile var message: String? = null
        private set
    @Volatile var at: Long? = null
        private set

    fun record(tag: String, text: String, throwable: Throwable?) {
        if (tag in NETWORK_TAGS) return
        val cause = throwable?.let { " (${it.javaClass.simpleName}${it.message?.let { m -> ": $m" } ?: ""})" } ?: ""
        message = "$tag: $text$cause".take(MAX_LENGTH)
        at = System.currentTimeMillis()
    }
}
