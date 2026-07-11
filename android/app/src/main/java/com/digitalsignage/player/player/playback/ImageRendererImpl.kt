package com.digitalsignage.player.player.playback

import com.digitalsignage.player.domain.playback.ContentRenderer
import java.io.File

class ImageRendererImpl(
    private val onStateUpdate: (File) -> Unit
) : ContentRenderer {
    override fun render(file: File) {
        onStateUpdate(file)
    }
    override suspend fun stop() {
        // No-op for static images
    }
}
