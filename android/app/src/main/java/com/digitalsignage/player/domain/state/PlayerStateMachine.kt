package com.digitalsignage.player.domain.state

import com.digitalsignage.player.core.error.AppError
import com.digitalsignage.player.core.logging.Logger
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

enum class PlayerState {
    BOOTING, REGISTERING, SYNCING, DOWNLOADING, READY, PLAYING, OFFLINE, ERROR, RECOVERING
}

sealed class TransitionResult {
    object Success : TransitionResult()
    data class Invalid(val reason: String) : TransitionResult()
    data class Blocked(val reason: String) : TransitionResult()
    object Unchanged : TransitionResult()
}

interface PlayerStateMachine {
    val currentState: StateFlow<PlayerState>
    val targetState: StateFlow<PlayerState>
    val currentError: StateFlow<AppError?>
    
    fun setTargetState(state: PlayerState)
    fun transitionTo(newState: PlayerState): TransitionResult
    fun transitionToError(error: AppError)
}

@Singleton
class PlayerStateMachineImpl @Inject constructor(
    private val logger: Logger
) : PlayerStateMachine {

    private val _currentState = MutableStateFlow(PlayerState.BOOTING)
    override val currentState: StateFlow<PlayerState> = _currentState.asStateFlow()
    
    private val _targetState = MutableStateFlow(PlayerState.PLAYING) // Ultimate goal is usually playing
    override val targetState: StateFlow<PlayerState> = _targetState.asStateFlow()
    
    private val _currentError = MutableStateFlow<AppError?>(null)
    override val currentError: StateFlow<AppError?> = _currentError.asStateFlow()

    private val validTransitions = mapOf(
        PlayerState.BOOTING to setOf(PlayerState.REGISTERING, PlayerState.SYNCING, PlayerState.ERROR),
        PlayerState.REGISTERING to setOf(PlayerState.SYNCING, PlayerState.ERROR),
        PlayerState.SYNCING to setOf(PlayerState.DOWNLOADING, PlayerState.READY, PlayerState.OFFLINE, PlayerState.ERROR),
        PlayerState.DOWNLOADING to setOf(PlayerState.READY, PlayerState.ERROR),
        PlayerState.READY to setOf(PlayerState.PLAYING, PlayerState.SYNCING),
        PlayerState.PLAYING to setOf(PlayerState.SYNCING, PlayerState.ERROR),
        PlayerState.OFFLINE to setOf(PlayerState.SYNCING, PlayerState.READY, PlayerState.PLAYING, PlayerState.ERROR),
        PlayerState.ERROR to setOf(PlayerState.RECOVERING),
        PlayerState.RECOVERING to setOf(PlayerState.BOOTING, PlayerState.SYNCING, PlayerState.ERROR)
    )

    override fun setTargetState(state: PlayerState) {
        _targetState.value = state
        logger.i("PlayerStateMachine", "Target state updated to ${state.name}")
    }

    override fun transitionTo(newState: PlayerState): TransitionResult {
        val current = _currentState.value
        
        if (current == newState) {
            return TransitionResult.Unchanged
        }
        
        val allowed = validTransitions[current]?.contains(newState) == true
        
        return if (allowed) {
            _currentState.value = newState
            _currentError.value = null
            logger.logEvent("StateTransition", mapOf("from" to current.name, "to" to newState.name, "target" to _targetState.value.name))
            TransitionResult.Success
        } else {
            logger.w("PlayerStateMachine", "Invalid state transition attempted: ${current.name} -> ${newState.name}")
            TransitionResult.Invalid("Transition from ${current.name} to ${newState.name} is not allowed in transition matrix.")
        }
    }

    override fun transitionToError(error: AppError) {
        val current = _currentState.value
        _currentError.value = error
        _currentState.value = PlayerState.ERROR
        logger.logEvent("ForcedStateTransitionToError", mapOf("from" to current.name, "error" to error.messageStr))
    }
}
