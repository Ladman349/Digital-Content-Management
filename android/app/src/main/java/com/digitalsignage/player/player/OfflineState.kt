package com.digitalsignage.player.player

sealed class OfflineState {
    object Online : OfflineState()
    object Offline : OfflineState()
    object Reconnecting : OfflineState()
}
