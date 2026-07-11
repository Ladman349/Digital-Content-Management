package com.digitalsignage.player.domain.playback

import java.io.File

interface ContentRenderer {
    fun render(file: File)
    suspend fun stop()
}
