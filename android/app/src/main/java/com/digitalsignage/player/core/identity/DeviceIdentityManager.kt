package com.digitalsignage.player.core.identity

import android.annotation.SuppressLint
import android.content.Context
import android.os.Build
import android.provider.Settings
import android.os.Environment
import android.os.StatFs
import android.util.DisplayMetrics
import android.view.WindowManager
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.TimeZone
import java.util.Locale
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

data class DeviceRegistrationMetadata(
    val androidId: String,
    val manufacturer: String,
    val model: String,
    val androidVersion: String,
    val appVersion: String, // from BuildConfig or packageManager
    val screenResolution: String,
    val availableStorageMb: Long,
    val timeZone: String,
    val locale: String
)

@Singleton
class DeviceIdentityManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    fun generateAppInstallationId(): String {
        return UUID.randomUUID().toString()
    }
    
    @SuppressLint("HardwareIds")
    fun getDeviceMetadata(): DeviceRegistrationMetadata {
        val androidId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID) ?: "unknown_android_id"
        
        var resolution = "Unknown"
        try {
            val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as? WindowManager
            if (windowManager != null) {
                val metrics = DisplayMetrics()
                windowManager.defaultDisplay.getMetrics(metrics)
                resolution = "${metrics.widthPixels}x${metrics.heightPixels}"
            }
        } catch (e: Exception) {
            android.util.Log.w("DeviceIdentityManager", "Failed to obtain display metrics, falling back to 'Unknown'", e)
        }
        
        val stat = StatFs(Environment.getDataDirectory().path)
        val availableBytes = stat.availableBlocksLong * stat.blockSizeLong
        val availableMb = availableBytes / (1024 * 1024)
        
        val pInfo = context.packageManager.getPackageInfo(context.packageName, 0)
        val appVersion = pInfo.versionName
        
        return DeviceRegistrationMetadata(
            androidId = androidId,
            manufacturer = Build.MANUFACTURER,
            model = Build.MODEL,
            androidVersion = Build.VERSION.RELEASE,
            appVersion = appVersion,
            screenResolution = resolution,
            availableStorageMb = availableMb,
            timeZone = TimeZone.getDefault().id,
            locale = Locale.getDefault().toString()
        )
    }
}
