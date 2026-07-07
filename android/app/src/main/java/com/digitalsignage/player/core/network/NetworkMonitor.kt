package com.digitalsignage.player.core.network

import kotlinx.coroutines.flow.Flow

enum class NetworkStatus { AVAILABLE, UNAVAILABLE, LOSING, LOST }

interface NetworkMonitor {
    val status: Flow<NetworkStatus>
    val isOnline: Flow<Boolean>
}
