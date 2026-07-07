package com.digitalsignage.player.core.network

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class NetworkMonitorImpl @Inject constructor() : NetworkMonitor {
    private val _status = MutableStateFlow(NetworkStatus.AVAILABLE)
    override val status: Flow<NetworkStatus> = _status.asStateFlow()
    
    private val _isOnline = MutableStateFlow(true)
    override val isOnline: Flow<Boolean> = _isOnline.asStateFlow()
}
