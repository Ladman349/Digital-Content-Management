package com.digitalsignage.player.ui

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.digitalsignage.player.DigitalSignageApplication
import com.digitalsignage.player.databinding.ActivitySplashBinding
import com.digitalsignage.player.core.recovery.StartupReason

@SuppressLint("HardwareIds")
class SplashActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySplashBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        DigitalSignageApplication.logger.i("StartupTrace", "2. SplashActivity.onCreate() starting")
        binding = ActivitySplashBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // SplashActivity no longer manages credentials. It directly starts PlaybackActivity.
        navigateToPlayback()
    }

    private fun navigateToPlayback() {
        DigitalSignageApplication.logger.i("StartupTrace", "9. SplashActivity.navigateToPlayback() called")
        val reason = intent.getStringExtra("startup_reason") ?: StartupReason.NORMAL.name
        val intent = Intent(this, PlaybackActivity::class.java).apply {
            putExtra("startup_reason", reason)
        }
        startActivity(intent)
        finish()
    }
}


