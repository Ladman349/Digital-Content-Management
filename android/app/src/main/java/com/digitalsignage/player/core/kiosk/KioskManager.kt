package com.digitalsignage.player.core.kiosk

import android.app.Activity
import android.app.ActivityManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import com.digitalsignage.player.core.logging.Logger
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton
import com.digitalsignage.player.data.local.datastore.RuntimeConfigStoreImpl
import com.digitalsignage.player.BuildConfig
import com.digitalsignage.player.core.event.PlayerEvent
import com.digitalsignage.player.core.event.PlayerEventBus

@Singleton
class KioskManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val dataStore: RuntimeConfigStoreImpl,
    private val eventBus: PlayerEventBus,
    private val logger: Logger
) {
    private val devicePolicyManager = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    private val adminComponent = ComponentName(context, SignageDeviceAdminReceiver::class.java)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    
    private var isMaintenanceModeActive = false
    private var isKioskEngaged = false
    private var cachedDeploymentMode = if (BuildConfig.DEBUG) DeploymentMode.DEVELOPMENT else DeploymentMode.PRODUCTION

    init {
        scope.launch {
            dataStore.deploymentMode.collectLatest { modeString ->
                if (!modeString.isNullOrEmpty()) {
                    try {
                        cachedDeploymentMode = DeploymentMode.valueOf(modeString.uppercase())
                    } catch (e: Exception) {
                        logger.w("KioskManager", "Invalid DeploymentMode string: $modeString.")
                    }
                }
            }
        }
    }

    fun getDeploymentMode(): DeploymentMode {
        return cachedDeploymentMode
    }

    fun isDeviceOwner(): Boolean {
        return devicePolicyManager.isDeviceOwnerApp(context.packageName)
    }
    
    fun isKioskActive(): Boolean {
        return isKioskEngaged && !isMaintenanceModeActive
    }

    fun enableKiosk(activity: Activity) {
        if (isMaintenanceModeActive) {
            logger.i("KioskManager", "Maintenance mode is active. Deferring kiosk enable.")
            return
        }
        
        val mode = getDeploymentMode()
        logger.i("KioskManager", "Enabling Kiosk with DeploymentMode: $mode")
        
        when (mode) {
            DeploymentMode.DEVELOPMENT -> {
                logger.i("KioskManager", "DEVELOPMENT mode: Kiosk disabled.")
                isKioskEngaged = false
            }
            DeploymentMode.TESTING -> {
                logger.i("KioskManager", "TESTING mode: Engaging Screen Pinning.")
                try {
                    activity.startLockTask()
                    isKioskEngaged = true
                } catch (e: Exception) {
                    logger.e("KioskManager", "Failed to engage Screen Pinning", e)
                }
            }
            DeploymentMode.PRODUCTION -> {
                if (isDeviceOwner()) {
                    logger.i("KioskManager", "PRODUCTION mode: Engaging Device Owner LockTask.")
                    try {
                        // Whitelist the app for LockTask
                        devicePolicyManager.setLockTaskPackages(adminComponent, arrayOf(context.packageName))
                        // Optionally suppress features
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                            devicePolicyManager.setLockTaskFeatures(adminComponent, DevicePolicyManager.LOCK_TASK_FEATURE_NONE)
                        }
                        activity.startLockTask()
                        isKioskEngaged = true
                    } catch (e: Exception) {
                        logger.e("KioskManager", "Failed to engage Device Owner LockTask", e)
                    }
                } else {
                    logger.e("KioskManager", "PRODUCTION mode requested, but app is NOT Device Owner. Publishing DeviceNotProvisioned.")
                    eventBus.publish(PlayerEvent.DeviceNotProvisioned)
                    try {
                        activity.startLockTask()
                        isKioskEngaged = true
                    } catch (e: Exception) {
                        logger.e("KioskManager", "Failed to engage Screen Pinning fallback", e)
                    }
                }
            }
        }
    }

    fun disableKiosk(activity: Activity) {
        logger.i("KioskManager", "Disabling Kiosk mode.")
        try {
            activity.stopLockTask()
            isKioskEngaged = false
        } catch (e: Exception) {
            logger.e("KioskManager", "Failed to stop LockTask", e)
        }
    }

    fun enterMaintenanceMode(activity: Activity) {
        logger.i("KioskManager", "Entering Maintenance Mode.")
        isMaintenanceModeActive = true
        disableKiosk(activity)
    }

    fun exitMaintenanceMode(activity: Activity) {
        logger.i("KioskManager", "Exiting Maintenance Mode.")
        isMaintenanceModeActive = false
        enableKiosk(activity)
    }
}
