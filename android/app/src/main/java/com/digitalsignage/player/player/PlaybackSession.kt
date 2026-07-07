package com.digitalsignage.player.player

/**
 * Lightweight abstraction representing the current playback state.
 * Owned and managed by PlaybackController.
 * Passed to PlaybackEngine when playback should start or reload.
 */
data class PlaybackSession(
    val playlistId: String,
    val playlistName: String,
    val playlistVersion: Long,
    val items: List<PlayableMedia>,
    val currentIndex: Int = 0,
    val isReloadRequested: Boolean = false
) {
    val currentItem: PlayableMedia?
        get() = items.getOrNull(currentIndex)

    val hasItems: Boolean
        get() = items.isNotEmpty()

    val itemCount: Int
        get() = items.size

    fun nextIndex(): Int {
        if (items.isEmpty()) return 0
        return (currentIndex + 1) % items.size
    }

    fun withIndex(index: Int): PlaybackSession = copy(currentIndex = index, isReloadRequested = false)

    fun withReloadRequest(): PlaybackSession = copy(isReloadRequested = true)
}
