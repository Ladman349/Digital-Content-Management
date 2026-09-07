package com.digitalsignage.player.presentation

import java.io.File

/**
 * What the TV screen should show right now.
 *
 * Media states ([Loading], [Image], [Video]) are produced by the playback engine and always win.
 * Status states are produced by the orchestrator from the player state machine, download
 * progress and network monitor, and are shown whenever no media is on screen.
 */
sealed class PresentationState {
    /** Engine is not rendering anything; the store maps this to the current status state. */
    object Idle : PresentationState()
    object Loading : PresentationState()
    data class Image(val file: File) : PresentationState()
    data class Video(val file: File) : PresentationState()

    // Status states
    object Booting : PresentationState()
    object Registering : PresentationState()
    object Syncing : PresentationState()
    data class Downloading(val completed: Int, val total: Int, val percent: Int) : PresentationState()
    object Offline : PresentationState()
    data class Error(val message: String) : PresentationState()
    object NoContent : PresentationState()

    val isMedia: Boolean
        get() = this is Loading || this is Image || this is Video
}
