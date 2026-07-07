package com.digitalsignage.player.core.storage

import android.content.Context
import android.os.Environment
import android.os.StatFs
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class StorageManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val MIN_AVAILABLE_BYTES = 500L * 1024L * 1024L // 500MB
    
    fun getMediaDirectory(): File {
        val dir = File(context.filesDir, "media")
        if (!dir.exists()) dir.mkdirs()
        return dir
    }
    
    fun isStorageAvailable(requiredBytes: Long = 0): Boolean {
        val stat = StatFs(getMediaDirectory().path)
        val availableBytes = stat.availableBlocksLong * stat.blockSizeLong
        return (availableBytes - requiredBytes) > MIN_AVAILABLE_BYTES
    }
    
    fun cleanupOrphans(activeMediaIds: List<String>) {
        val mediaDir = getMediaDirectory()
        val files = mediaDir.listFiles() ?: return
        
        for (file in files) {
            val fileName = file.name
            val hasActivePrefix = activeMediaIds.any { fileName.startsWith("${it}_") || fileName == it }
            if (!hasActivePrefix && !fileName.endsWith(".tmp")) {
                file.delete()
            }
        }
    }
    
    fun cleanupTempFiles() {
        val mediaDir = getMediaDirectory()
        mediaDir.listFiles()?.forEach { file ->
            if (file.name.endsWith(".tmp")) {
                file.delete()
            }
        }
    }
}
