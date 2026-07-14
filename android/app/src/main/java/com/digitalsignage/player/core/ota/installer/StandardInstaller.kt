package com.digitalsignage.player.core.ota.installer

import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.content.FileProvider
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class StandardInstaller @Inject constructor() {
    companion object {
        private const val TAG = "KioskTrace"
    }

    fun install(context: Context, apkFile: File): InstallResult {
        Log.i(TAG, "[OTA] StandardInstaller triggering system UI package installation...")
        return try {
            val authority = "${context.packageName}.fileprovider"
            val apkUri = FileProvider.getUriForFile(context, authority, apkFile)

            @Suppress("DEPRECATION")
            val intent = Intent(Intent.ACTION_INSTALL_PACKAGE).apply {
                data = apkUri
                flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK
                putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true)
                putExtra(Intent.EXTRA_RETURN_RESULT, true)
            }
            context.startActivity(intent)
            InstallResult.Installing
        } catch (e: Exception) {
            val err = "StandardInstaller failed: ${e.message}"
            Log.e(TAG, "[OTA] $err", e)
            InstallResult.Failed(err)
        }
    }
}
