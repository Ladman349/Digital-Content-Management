package com.digitalsignage.player.core.network

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Real connectivity monitor backed by [ConnectivityManager.NetworkCallback].
 * A network counts as online when it has INTERNET capability (validated when the platform
 * reports it). The callback is registered once for the process lifetime.
 */
@Singleton
class NetworkMonitorImpl @Inject constructor(
    @ApplicationContext context: Context
) : NetworkMonitor {

    private val connectivityManager =
        context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    private val availableNetworks = java.util.Collections.synchronizedSet(mutableSetOf<Network>())

    private val _status = MutableStateFlow(NetworkStatus.UNAVAILABLE)
    override val status: Flow<NetworkStatus> = _status.asStateFlow()

    private val _isOnline = MutableStateFlow(false)
    override val isOnline: Flow<Boolean> = _isOnline.asStateFlow()

    /** Synchronous snapshot for callers that cannot collect a flow. */
    val isOnlineNow: Boolean get() = _isOnline.value

    private val callback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            availableNetworks.add(network)
            publish(NetworkStatus.AVAILABLE)
        }

        override fun onLosing(network: Network, maxMsToLive: Int) {
            publish(NetworkStatus.LOSING)
        }

        override fun onLost(network: Network) {
            availableNetworks.remove(network)
            publish(if (availableNetworks.isEmpty()) NetworkStatus.LOST else NetworkStatus.AVAILABLE)
        }

        override fun onUnavailable() {
            publish(NetworkStatus.UNAVAILABLE)
        }

        override fun onCapabilitiesChanged(network: Network, networkCapabilities: NetworkCapabilities) {
            val usable = networkCapabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            if (usable) availableNetworks.add(network) else availableNetworks.remove(network)
            publish(if (availableNetworks.isEmpty()) NetworkStatus.LOST else NetworkStatus.AVAILABLE)
        }
    }

    init {
        // Seed from the current active network so the first emission is accurate.
        val active = connectivityManager.activeNetwork
        val caps = active?.let { connectivityManager.getNetworkCapabilities(it) }
        if (active != null && caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true) {
            availableNetworks.add(active)
            publish(NetworkStatus.AVAILABLE)
        }
        try {
            val request = NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build()
            connectivityManager.registerNetworkCallback(request, callback)
        } catch (e: Exception) {
            android.util.Log.e("NetworkMonitor", "Failed to register network callback", e)
        }
    }

    private fun publish(status: NetworkStatus) {
        _status.value = status
        _isOnline.value = status == NetworkStatus.AVAILABLE || status == NetworkStatus.LOSING
    }
}
