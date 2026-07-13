package com.digitalsignage.player.player.playback

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
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
            
        com.digitalsignage.player.core.performance.PerformanceMonitor.onSetMediaItem()
        android.util.Log.i("LIFECYCLE_TRACE", "BEFORE setMediaItem()")
        exoPlayer.setMediaItem(exoItem)
        android.util.Log.i("LIFECYCLE_TRACE", "AFTER setMediaItem()")
        
        com.digitalsignage.player.core.performance.PerformanceMonitor.onPrepare()
        android.util.Log.i("LIFECYCLE_TRACE", "BEFORE prepare()")
        exoPlayer.prepare()
        android.util.Log.i("LIFECYCLE_TRACE", "AFTER prepare()")
        
        exoPlayer.play()
    }

    override suspend fun stop() {
        withContext(Dispatchers.Main.immediate) {
            android.util.Log.i("LIFECYCLE_TRACE", "BEFORE stop()")
            exoPlayer.stop()
            android.util.Log.i("LIFECYCLE_TRACE", "AFTER stop()")
            
            android.util.Log.i("LIFECYCLE_TRACE", "BEFORE clearMediaItems()")
            exoPlayer.clearMediaItems()
            android.util.Log.i("LIFECYCLE_TRACE", "AFTER clearMediaItems()")
        }
    }
}
