package com.digitalsignage.player.data.remote.dto

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = false)
data class DeviceRegisterRequest(
    val name: String,
    val resolution: String,
    val ipAddress: String?,
    val appVersion: String?,
    val androidId: String?
)

@JsonClass(generateAdapter = false)
data class DeviceRegisterResponse(
    val deviceId: String,
    val deviceToken: String,
    val heartbeatInterval: Int,
    val syncInterval: Int,
    val backendTime: String? = null
)
