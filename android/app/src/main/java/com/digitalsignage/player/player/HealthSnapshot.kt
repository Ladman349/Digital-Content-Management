package com.digitalsignage.player.player

/**
 * Immutable snapshot of the device's current health metrics.
 * Collected by DeviceHealthMonitor.
 */
data class HealthSnapshot(
    val storageUsedMb: Float,
    val storageTotalMb: Float,
    val cacheUsagePercent: Float,
    val uptimeSeconds: Long,
    val isNetworkConnected: Boolean,
    val availableMemoryMb: Float? = null,
    val cacheIntegrityValid: Boolean = true
)
