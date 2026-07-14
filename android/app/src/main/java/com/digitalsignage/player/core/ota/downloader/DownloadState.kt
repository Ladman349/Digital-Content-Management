package com.digitalsignage.player.core.ota.downloader

sealed interface DownloadState {
    object Idle : DownloadState
    object Downloading : DownloadState
    data class Progress(val percent: Int) : DownloadState
    object Verifying : DownloadState
    object Completed : DownloadState
    data class Failed(val reason: String) : DownloadState
}
