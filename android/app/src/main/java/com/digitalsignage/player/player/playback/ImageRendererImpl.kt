package com.digitalsignage.player.player.playback

import com.digitalsignage.player.domain.playback.ContentRenderer
import java.io.File

class ImageRendererImpl(
    private val onStateUpdate: (File) -> Unit
) : ContentRenderer {
    override fun render(file: File) {
        onStateUpdate(file)
    }
    override fun stop() {
        // No-op for static images
    }
}
