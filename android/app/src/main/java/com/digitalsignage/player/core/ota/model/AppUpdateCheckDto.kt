package com.digitalsignage.player.core.ota.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class AppUpdateCheckDto(
    @Json(name = "updateAvailable") val updateAvailable: Boolean,
    @Json(name = "currentVersionCode") val currentVersionCode: Int,
    @Json(name = "latestVersionCode") val latestVersionCode: Int?,
    @Json(name = "versionName") val versionName: String?,
    @Json(name = "apkUrl") val apkUrl: String?,
    @Json(name = "checksum") val checksum: String?,
    @Json(name = "fileSize") val fileSize: Long?,
    @Json(name = "mandatory") val mandatory: Boolean?,
    @Json(name = "releaseNotes") val releaseNotes: String?
)
