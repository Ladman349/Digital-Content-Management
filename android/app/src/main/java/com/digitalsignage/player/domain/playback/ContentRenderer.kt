package com.digitalsignage.player.domain.playback

import java.io.File

interface ContentRenderer {
    fun render(file: File)
    fun stop()
}
