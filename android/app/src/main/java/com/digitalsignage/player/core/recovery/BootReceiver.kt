package com.digitalsignage.player.core.recovery

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.digitalsignage.player.core.logging.Logger
import com.digitalsignage.player.core.event.PlayerEventBus
import com.digitalsignage.player.core.event.PlayerEvent
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@AndroidEntryPoint
class BootReceiver : BroadcastReceiver() {

    @Inject lateinit var logger: Logger
    @Inject lateinit var eventBus: PlayerEventBus
    @Inject lateinit var startupValidator: StartupValidator

    /**
     * Handles device boot and package replacement events.
     * 
     * Boot Strategy (Android TV):
     * 1. Device Owner / Dedicated Device mode is the preferred deployment strategy.
     *    When provisioned as Device Owner, the application is exempted from 
     *    background activity launch restrictions (Android 10+).
     * 2. Launcher Fallback: If not Device Owner, the app must be set as the default
     *    Launcher/Home app so that the OS starts it automatically.
     * 3. SYSTEM_ALERT_WINDOW is retained only for exceptional OEM-specific deployments
     *    where absolutely necessary and standard methods fail.
     * 
     * Note: BootReceiver no longer directly launches the UI. It delegates to the
     * centralized recovery subsystem (StartupValidator) to evaluate conditions and 
     * orchestrate the startup safely.
     */
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || 
            intent.action == Intent.ACTION_LOCKED_BOOT_COMPLETED ||
            intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            
            logger.i("BootReceiver", "Received boot/update intent: ${intent.action}")
            
            val pendingResult = goAsync()
            // Publish Boot event to the system
            CoroutineScope(Dispatchers.Default).launch {
                try {
                    eventBus.publish(PlayerEvent.BootCompleted)
                } finally {
                    pendingResult.finish()
                }
            }
            
            // Trigger centralized recovery pipeline
            startupValidator.initiateStartup(context, StartupReason.BOOT)
        }
    }
}
