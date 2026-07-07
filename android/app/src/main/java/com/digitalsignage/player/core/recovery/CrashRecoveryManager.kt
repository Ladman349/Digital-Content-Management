package com.digitalsignage.player.core.recovery

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import com.digitalsignage.player.core.event.PlayerEvent
import com.digitalsignage.player.core.event.PlayerEventBus
import com.digitalsignage.player.core.logging.Logger
import com.digitalsignage.player.ui.SplashActivity
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.system.exitProcess
import android.os.Build

@Singleton
class CrashRecoveryManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val logger: Logger,
    private val eventBus: PlayerEventBus
) : Thread.UncaughtExceptionHandler {

    private val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
    private val prefs: SharedPreferences = context.getSharedPreferences("crash_recovery_prefs", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_CRASH_COUNT = "crash_count"
        private const val KEY_LAST_CRASH_TIME = "last_crash_time"
        private const val CRASH_WINDOW_MS = 5 * 60 * 1000L // 5 minutes
        private const val MAX_CRASHES = 3
    }

    fun initialize() {
        Thread.setDefaultUncaughtExceptionHandler(this)
        logger.i("CrashRecoveryManager", "Initialized crash recovery manager")
    }

    override fun uncaughtException(thread: Thread, throwable: Throwable) {
        logger.e("CrashRecoveryManager", "Uncaught exception detected", throwable)
        
        val now = System.currentTimeMillis()
        val lastCrashTime = prefs.getLong(KEY_LAST_CRASH_TIME, 0)
        var crashCount = prefs.getInt(KEY_CRASH_COUNT, 0)

        if (now - lastCrashTime < CRASH_WINDOW_MS) {
            crashCount++
        } else {
            crashCount = 1
        }

        // Synchronous commit() is intentionally retained here for crash metadata.
        // During an uncaught exception, the application process is crashing and will be terminated
        // immediately after this method returns. If we used asynchronous apply(), the write operation
        // might not complete before the process dies, causing the crash count to fail to increment.
        prefs.edit()
            .putLong(KEY_LAST_CRASH_TIME, now)
            .putInt(KEY_CRASH_COUNT, crashCount)
            .commit()

        if (crashCount <= MAX_CRASHES) {
            logger.i("CrashRecoveryManager", "Crash count $crashCount within window. Scheduling restart.")
            scheduleRestart()
        } else {
            logger.e("CrashRecoveryManager", "Crash loop detected ($crashCount crashes). Aborting auto-restart.")
            eventBus.publish(PlayerEvent.RecoveryFailed("Crash loop detected"))
        }

        defaultHandler?.uncaughtException(thread, throwable) ?: exitProcess(1)
    }

    private fun scheduleRestart() {
        val intent = Intent(context, SplashActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
            putExtra("startup_reason", StartupReason.CRASH_RECOVERY.name)
        }
        val pendingIntent = PendingIntent.getActivity(
            context, 0, intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )

        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val triggerAtMillis = System.currentTimeMillis() + 1000

        // Prefer exact alarm for immediate recovery, otherwise fall back to inexact alarm
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (alarmManager.canScheduleExactAlarms()) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
            } else {
                alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
        } else {
            alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
        }
        
        eventBus.publish(PlayerEvent.RestartScheduled)
    }

    fun resetCrashCount() {
        prefs.edit().putInt(KEY_CRASH_COUNT, 0).apply()
    }
}
