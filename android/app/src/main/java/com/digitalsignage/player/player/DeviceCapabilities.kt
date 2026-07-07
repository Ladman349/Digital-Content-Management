package com.digitalsignage.player.player

/**
 * Static or semi-static capabilities of the device.
 */
data class DeviceCapabilities(
    val manufacturer: String,
    val model: String,
    val androidVersion: String,
    val appVersion: String,
    val totalStorage: Float,
    val availableStorage: Float,
    val maximumResolution: String? = null
)
