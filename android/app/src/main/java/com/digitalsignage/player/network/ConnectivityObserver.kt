package com.digitalsignage.player.network

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import com.digitalsignage.player.DigitalSignageApplication
import com.digitalsignage.player.player.DeviceEvent
import com.digitalsignage.player.player.DeviceEventBus
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Monitors network connectivity without polling.
 * Debounces rapid flapping and publishes state to DeviceEventBus.
 */
class ConnectivityObserver(context: Context) {

    private val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    private val scope = CoroutineScope(Dispatchers.Main + Job())
    private var debounceJob: Job? = null
    
    private var isCurrentlyConnected = false
    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            handleStateChange(true)
        }

        override fun onLost(network: Network) {
            handleStateChange(false)
        }
    }

    init {
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
            
        // Initial state check
        val activeNetwork = connectivityManager.activeNetwork
        if (activeNetwork != null) {
            val caps = connectivityManager.getNetworkCapabilities(activeNetwork)
            isCurrentlyConnected = caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
        }

        connectivityManager.registerNetworkCallback(request, networkCallback)
    }

    private fun handleStateChange(connected: Boolean) {
        if (isCurrentlyConnected == connected) return
        
        debounceJob?.cancel()
        debounceJob = scope.launch {
            // Debounce by 3 seconds
            delay(3000)
            
            isCurrentlyConnected = connected
            if (connected) {
                DigitalSignageApplication.logger.i("ConnectivityObserver", "Connectivity restored")
                DeviceEventBus.publish(DeviceEvent.ConnectivityRestored)
            } else {
                DigitalSignageApplication.logger.w("ConnectivityObserver", "Connectivity lost")
                DeviceEventBus.publish(DeviceEvent.ConnectivityLost)
            }
        }
    }
    
    fun shutdown() {
        debounceJob?.cancel()
        try {
            connectivityManager.unregisterNetworkCallback(networkCallback)
        } catch (e: Exception) {
            DigitalSignageApplication.logger.e("ConnectivityObserver", "Failed to unregister network callback: ${e.message}")
        }
    }
}
