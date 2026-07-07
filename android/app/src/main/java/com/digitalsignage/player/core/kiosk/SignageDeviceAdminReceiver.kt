package com.digitalsignage.player.core.kiosk

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import com.digitalsignage.player.core.logging.Logger
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class SignageDeviceAdminReceiver : DeviceAdminReceiver() {
    
    @Inject lateinit var logger: Logger

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        logger.i("SignageDeviceAdminReceiver", "Device Admin Enabled")
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
        logger.w("SignageDeviceAdminReceiver", "Device Admin Disabled")
    }

    override fun onLockTaskModeEntering(context: Context, intent: Intent, pkg: String) {
        super.onLockTaskModeEntering(context, intent, pkg)
        logger.i("SignageDeviceAdminReceiver", "Entering LockTask mode for package: $pkg")
    }

    override fun onLockTaskModeExiting(context: Context, intent: Intent) {
        super.onLockTaskModeExiting(context, intent)
        logger.w("SignageDeviceAdminReceiver", "Exiting LockTask mode")
    }
}
