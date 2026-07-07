package com.digitalsignage.player.core.version

data class AppVersions(
    val appVersion: String,
    val apiVersion: String,
    val databaseVersion: Int,
    val configVersion: Int
)

interface VersionProvider {
    fun getCurrentVersions(): AppVersions
}
