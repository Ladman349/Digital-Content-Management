package com.digitalsignage.player

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class DigitalSignageApplication : Application(), Configuration.Provider {

    companion object {
        val logger = com.digitalsignage.player.core.logging.AndroidLogger()
    }

    @Inject
    lateinit var workerFactory: HiltWorkerFactory

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()
            
    override fun onCreate() {
        super.onCreate()
        logger.i("StartupTrace", "1. Application.onCreate() executed")
    }
}

