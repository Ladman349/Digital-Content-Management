package com.digitalsignage.player.presentation

import java.io.File

sealed class PresentationState {
    object Idle : PresentationState()
    object Loading : PresentationState()
    data class Image(val file: File) : PresentationState()
    data class Video(val file: File) : PresentationState()
}
