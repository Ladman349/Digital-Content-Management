package com.digitalsignage.player.core.config

import kotlinx.coroutines.flow.Flow

interface ConfigurationProvider {
    // Build-time / Environment configs
    val apiBaseUrl: String
    val environment: String
    
    // Runtime configs (Mutable via DataStore)
    val heartbeatIntervalMs: Flow<Long>
    val syncIntervalMs: Flow<Long>
    val downloadRetryPolicyMaxAttempts: Flow<Int>
    val kioskModeEnabled: Flow<Boolean>
    
    suspend fun updateKioskMode(enabled: Boolean)
    suspend fun updateHeartbeatInterval(interval: Long)
}

interface RuntimeConfigStore {
    val deviceToken: Flow<String?>
    val isRegistered: Flow<Boolean>
    suspend fun saveDeviceToken(token: String)
}
