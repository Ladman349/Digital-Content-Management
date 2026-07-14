package com.digitalsignage.player.core.ota.installer

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageInstaller
import android.os.Build
import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import java.io.File
import java.io.FileInputStream
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SilentInstaller @Inject constructor() {
    companion object {
        private const val TAG = "KioskTrace"
        private const val ACTION_INSTALL_STATUS = "com.digitalsignage.player.ACTION_INSTALL_STATUS"
    }

    private var statusReceiver: BroadcastReceiver? = null

    fun install(
        context: Context,
        apkFile: File,
        stateFlow: MutableStateFlow<InstallResult>
    ) {
        Log.i(TAG, "[OTA] SilentInstaller initiating session stream installation...")
        val packageInstaller = context.packageManager.packageInstaller

        // 1. Clean up old receivers if any
        unregisterReceiver(context)

        // 2. Register BroadcastReceiver to capture PackageInstaller Session Callbacks
        statusReceiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
                val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
                val message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE) ?: "No detailed status message"

                when (status) {
                    PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                        Log.w(TAG, "[OTA] SilentInstall status: Pending user confirmation. Fallback to standard installation may be required.")
                        stateFlow.value = InstallResult.RequiresUserConfirmation
                    }
                    PackageInstaller.STATUS_SUCCESS -> {
                        Log.i(TAG, "[OTA] SilentInstall status: Success! Installation complete. Package will be replaced.")
                        stateFlow.value = InstallResult.Installed
                        unregisterReceiver(ctx)
                    }
                    else -> {
                        val err = "Installation failed: Status = $status, Message = $message"
                        Log.e(TAG, "[OTA] SilentInstall status: $err")
                        stateFlow.value = InstallResult.Failed(err)
                        unregisterReceiver(ctx)
                    }
                }
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(
                statusReceiver,
                IntentFilter(ACTION_INSTALL_STATUS),
                Context.RECEIVER_EXPORTED
            )
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            context.registerReceiver(
                statusReceiver,
                IntentFilter(ACTION_INSTALL_STATUS)
            )
        }

        var session: PackageInstaller.Session? = null
        try {
            val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
            }

            val sessionId = packageInstaller.createSession(params)
            session = packageInstaller.openSession(sessionId)

            val apkSize = apkFile.length()
            val inputStream = FileInputStream(apkFile)
            val outputStream = session.openWrite("update_stream", 0, apkSize)

            val buffer = ByteArray(65536)
            var bytesRead: Int
            inputStream.use { input ->
                outputStream.use { out ->
                    while (input.read(buffer).also { bytesRead = it } != -1) {
                        out.write(buffer, 0, bytesRead)
                    }
                    session.fsync(out)
                }
            }

            // 3. Create PendingIntent for installation feedback broadcast
            val intent = Intent(ACTION_INSTALL_STATUS).apply {
                `package` = context.packageName
            }
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                sessionId,
                intent,
                flags
            )

            // 4. Commit session (Trigger installation)
            stateFlow.value = InstallResult.InstallCommitted
            Log.i(TAG, "[OTA] SilentInstaller session committed. Waiting for status callback...")
            session.commit(pendingIntent.intentSender)

        } catch (e: Exception) {
            val err = "SilentInstaller stream execution failed: ${e.message}"
            Log.e(TAG, "[OTA] $err", e)
            stateFlow.value = InstallResult.Failed(err)
            session?.abandon()
            unregisterReceiver(context)
        } finally {
            session?.close()
        }
    }

    private fun unregisterReceiver(context: Context) {
        statusReceiver?.let {
            try {
                context.unregisterReceiver(it)
            } catch (e: Exception) {
                // Ignore if not registered
            }
            statusReceiver = null
        }
    }
}
