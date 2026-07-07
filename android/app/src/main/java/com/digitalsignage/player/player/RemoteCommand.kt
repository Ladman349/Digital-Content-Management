package com.digitalsignage.player.player

sealed interface RemoteCommand {
    object RefreshPlaylist : RemoteCommand
    object ForceSync : RemoteCommand
    object RestartPlayer : RemoteCommand
    object RebootDevice : RemoteCommand
    object ClearCache : RemoteCommand
    object ForceHeartbeat : RemoteCommand
}
