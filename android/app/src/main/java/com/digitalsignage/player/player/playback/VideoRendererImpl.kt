package com.digitalsignage.player.player.playback

import android.os.Handler
import android.os.Looper
import androidx.media3.common.MediaItem as ExoMediaItem
import androidx.media3.exoplayer.ExoPlayer
import com.digitalsignage.player.domain.playback.ContentRenderer
import java.io.File

class VideoRendererImpl(
    private val exoPlayer: ExoPlayer,
    private val onStateUpdate: (File) -> Unit
) : ContentRenderer {

    private val mainHandler = Handler(Looper.getMainLooper())
    
    override fun render(file: File) {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            renderInternal(file)
        } else {
            mainHandler.post {
                renderInternal(file)
            }
        }
    }

    private fun renderInternal(file: File) {
        onStateUpdate(file)
        
        val exoItem = ExoMediaItem.Builder()
            .setUri(android.net.Uri.fromFile(file))
            .build()
            
        exoPlayer.setMediaItem(exoItem)
        exoPlayer.prepare()
        exoPlayer.play()
    }

    override fun stop() {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            stopInternal()
        } else {
            mainHandler.post {
                stopInternal()
            }
        }
    }

    private fun stopInternal() {
        exoPlayer.stop()
        exoPlayer.clearMediaItems()
    }
}
