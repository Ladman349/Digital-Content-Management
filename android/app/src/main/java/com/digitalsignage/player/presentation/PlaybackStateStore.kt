package com.digitalsignage.player.presentation

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Single source of truth for the screen. Keeps the engine's media state and the orchestrator's
 * status state separately and exposes their combination synchronously (no intermediate
 * emissions), so switching between playlist items never flashes the status screen.
 */
@Singleton
class PlaybackStateStore @Inject constructor() {
    private val lock = Any()
    private var mediaState: PresentationState? = null
    private var statusState: PresentationState = PresentationState.Booting

    private val _state = MutableStateFlow<PresentationState>(PresentationState.Booting)
    val state: StateFlow<PresentationState> = _state

    /** Called by the playback engine with [PresentationState.Idle], Loading, Image or Video. */
    fun updateState(newState: PresentationState) {
        synchronized(lock) {
            mediaState = if (newState.isMedia) newState else null
            recompute()
        }
    }

    /** Called by the orchestrator with a status state (Booting, Syncing, NoContent, ...). */
    fun updateSystemState(newState: PresentationState) {
        synchronized(lock) {
            statusState = if (newState.isMedia || newState is PresentationState.Idle) {
                PresentationState.NoContent
            } else {
                newState
            }
            recompute()
        }
    }

    private fun recompute() {
        _state.value = mediaState ?: statusState
    }
}
