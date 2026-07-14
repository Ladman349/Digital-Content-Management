package com.digitalsignage.player.core.ota.installer

sealed interface InstallResult {
    object Idle : InstallResult
    object Preparing : InstallResult
    object Validating : InstallResult
    object Installing : InstallResult
    object InstallCommitted : InstallResult
    object Installed : InstallResult
    object RequiresUserConfirmation : InstallResult
    object WaitingForReboot : InstallResult
    data class Failed(val reason: String) : InstallResult
    object Cancelled : InstallResult
}
