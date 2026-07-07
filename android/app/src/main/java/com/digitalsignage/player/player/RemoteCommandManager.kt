package com.digitalsignage.player.player

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow

/**
 * Placeholder architecture for integrating future WebSocket or FCM commands.
 * It will parse incoming pushes into RemoteCommand objects and emit them.
 */
class RemoteCommandManager {
    
    private val _commands = MutableSharedFlow<RemoteCommand>(extraBufferCapacity = 10)
    val commands = _commands.asSharedFlow()

    // Example API for future integration
    suspend fun onCommandReceived(command: RemoteCommand) {
        _commands.emit(command)
    }
}
