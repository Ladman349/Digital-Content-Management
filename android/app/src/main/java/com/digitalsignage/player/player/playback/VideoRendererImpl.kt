package com.digitalsignage.player.player.playback

import androidx.media3.common.MediaItem as ExoMediaItem
import androidx.media3.exoplayer.ExoPlayer
import com.digitalsignage.player.domain.playback.ContentRenderer
import java.io.File

class VideoRendererImpl(
    private val exoPlayer: ExoPlayer,
    private val onStateUpdate: (File) -> Unit
) : ContentRenderer {
    
    override fun render(file: File) {
        onStateUpdate(file)
        
        val exoItem = ExoMediaItem.Builder()
            .setUri(android.net.Uri.fromFile(file))
            .build()
            
        exoPlayer.setMediaItem(exoItem)
        exoPlayer.prepare()
        exoPlayer.play()
    }

    override fun stop() {
        exoPlayer.stop()
        exoPlayer.clearMediaItems()
    }
}
