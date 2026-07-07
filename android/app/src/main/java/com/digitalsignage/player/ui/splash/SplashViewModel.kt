package com.digitalsignage.player.ui.splash

import androidx.lifecycle.ViewModel
import com.digitalsignage.player.core.event.PlayerEvent
import com.digitalsignage.player.core.event.PlayerEventBus
import com.digitalsignage.player.domain.state.PlayerStateMachine
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class SplashViewModel @Inject constructor(
    private val eventBus: PlayerEventBus,
    val stateMachine: PlayerStateMachine
) : ViewModel() {

    fun onSplashReady() {
        eventBus.publish(PlayerEvent.SplashCompleted)
    }
}
