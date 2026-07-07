package com.digitalsignage.player.storage

data class MediaIntegrityStats(
    var checksumFailures: Int = 0,
    var missingFiles: Int = 0,
    var orphanedFiles: Int = 0,
    var recoveredFiles: Int = 0,
    var lastSuccessfulVerification: Long = 0L,
    var failedDownloadCount: Int = 0
)
