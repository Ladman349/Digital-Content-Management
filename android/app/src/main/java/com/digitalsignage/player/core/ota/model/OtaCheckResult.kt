package com.digitalsignage.player.core.ota.model

sealed interface OtaCheckResult {
    object NoUpdate : OtaCheckResult
    
    data class UpdateAvailable(
        val currentVersionCode: Int,
        val latestVersionCode: Int,
        val versionName: String,
        val apkUrl: String,
        val checksum: String,
        val fileSize: Long,
        val mandatory: Boolean,
        val releaseNotes: String?
    ) : OtaCheckResult
    
    data class Failure(
        val message: String,
        val throwable: Throwable? = null
    ) : OtaCheckResult
}
