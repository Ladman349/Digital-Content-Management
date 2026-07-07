package com.digitalsignage.player.core.utils

import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class FileValidator @Inject constructor() {
    
    fun validateFile(file: File, expectedMd5: String?, expectedSha256: String?, expectedSize: Long? = null): Boolean {
        if (!file.exists()) return false
        
        val actualSize = file.length()
        android.util.Log.i("DownloadTrace", "Validation -> Expected Size: $expectedSize, Actual Size: $actualSize")
        
        var sizeFailed = false
        if (expectedSize != null && expectedSize > 0L && actualSize != expectedSize) {
            sizeFailed = true
            android.util.Log.e("DownloadTrace", "Validation -> SIZE MISMATCH FAILED")
        }
        
        var checksumFailed = false
        if (!expectedSha256.isNullOrBlank()) {
            val sha256 = calculateHash(file, "SHA-256")
            android.util.Log.i("DownloadTrace", "Validation -> Expected SHA256: $expectedSha256, Actual SHA256: $sha256")
            if (!sha256.equals(expectedSha256, ignoreCase = true)) {
                checksumFailed = true
                android.util.Log.e("DownloadTrace", "Validation -> CHECKSUM MISMATCH FAILED (SHA-256)")
            }
        } else if (!expectedMd5.isNullOrBlank()) {
            val md5 = calculateHash(file, "MD5")
            android.util.Log.i("DownloadTrace", "Validation -> Expected MD5: $expectedMd5, Actual MD5: $md5")
            if (!md5.equals(expectedMd5, ignoreCase = true)) {
                checksumFailed = true
                android.util.Log.e("DownloadTrace", "Validation -> CHECKSUM MISMATCH FAILED (MD5)")
            }
        }
        
        if (sizeFailed && checksumFailed) {
            android.util.Log.e("DownloadTrace", "Validation -> BOTH SIZE AND CHECKSUM MISMATCH FAILED")
        }
        
        if (sizeFailed || checksumFailed) return false
        
        return true
    }
    
    private fun calculateHash(file: File, algorithm: String): String {
        val digest = MessageDigest.getInstance(algorithm)
        val inputStream = FileInputStream(file)
        val buffer = ByteArray(8192)
        var bytesRead: Int
        
        try {
            while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                digest.update(buffer, 0, bytesRead)
            }
        } finally {
            inputStream.close()
        }
        
        val md5Bytes = digest.digest()
        return md5Bytes.joinToString("") { "%02x".format(it) }
    }
}
