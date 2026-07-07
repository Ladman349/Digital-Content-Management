package com.digitalsignage.player.presentation

import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject

@HiltViewModel
class PlaybackViewModel @Inject constructor(
    private val stateStore: PlaybackStateStore
) : ViewModel() {
    val state: StateFlow<PresentationState> = stateStore.state
}
