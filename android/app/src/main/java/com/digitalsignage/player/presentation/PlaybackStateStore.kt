package com.digitalsignage.player.presentation

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PlaybackStateStore @Inject constructor() {
    private val _state = MutableStateFlow<PresentationState>(PresentationState.Idle)
    val state: StateFlow<PresentationState> = _state

    fun updateState(newState: PresentationState) {
        _state.value = newState
    }
}
