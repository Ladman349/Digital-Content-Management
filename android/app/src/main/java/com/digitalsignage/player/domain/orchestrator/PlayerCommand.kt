package com.digitalsignage.player.domain.orchestrator

sealed class PlayerCommand {
    object RegisterDevice : PlayerCommand()
    object SyncPlaylist : PlayerCommand()
    object StartPlayback : PlayerCommand()
    object RecoverPlayer : PlayerCommand()
    object RetryHeartbeat : PlayerCommand()
    object DownloadMedia : PlayerCommand()
}
