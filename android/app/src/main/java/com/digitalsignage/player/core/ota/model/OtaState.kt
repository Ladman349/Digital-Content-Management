package com.digitalsignage.player.core.ota.model

/**
 * Coarse, UI-facing state of the OTA pipeline owned by
 * [com.digitalsignage.player.core.ota.manager.OtaCoordinator].
 *
 * This is deliberately a *separate* flow from
 * [com.digitalsignage.player.presentation.PresentationState]: the playback status screen must keep
 * reporting playback/media-sync status, so APK downloads never hijack the media
 * `PresentationState.Downloading` state. The Activity may observe this flow for diagnostics only.
 */
sealed interface OtaState {
    object Idle : OtaState
    object Checking : OtaState
    object UpToDate : OtaState

    data class UpdateFound(
        val versionCode: Int,
        val versionName: String,
        val mandatory: Boolean
    ) : OtaState

    /** [percent] is -1 while the server does not advertise a content length. */
    data class Downloading(val percent: Int) : OtaState
    object Verifying : OtaState
    object ReadyForInstall : OtaState
    object Installing : OtaState
    object Installed : OtaState
    object Offline : OtaState
    data class Failed(val reason: String) : OtaState
}
