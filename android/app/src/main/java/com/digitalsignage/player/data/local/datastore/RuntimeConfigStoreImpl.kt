package com.digitalsignage.player.data.local.datastore

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import com.digitalsignage.player.core.config.RuntimeConfigStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "runtime_config")

@Singleton
class RuntimeConfigStoreImpl @Inject constructor(
    @ApplicationContext private val context: Context
) : RuntimeConfigStore {

    companion object {
        val PLAYLIST_ETAG = stringPreferencesKey("playlist_etag")
        val HEARTBEAT_INTERVAL = longPreferencesKey("heartbeat_interval")
        val DEVICE_TOKEN = stringPreferencesKey("device_token")
        val INSTALLATION_ID = stringPreferencesKey("installation_id")
        val DEVICE_ID = stringPreferencesKey("device_id")
        val REGISTRATION_TIMESTAMP = longPreferencesKey("registration_timestamp")
        val DEPLOYMENT_MODE = stringPreferencesKey("deployment_mode")
        val MAINTENANCE_PIN_HASH = stringPreferencesKey("maintenance_pin_hash")
        val MAINTENANCE_TIMEOUT = longPreferencesKey("maintenance_timeout")
    }

    override val deviceToken: Flow<String?> = context.dataStore.data.map { prefs -> prefs[DEVICE_TOKEN] }
    val deviceId: Flow<String?> = context.dataStore.data.map { prefs -> prefs[DEVICE_ID] }
    val installationId: Flow<String?> = context.dataStore.data.map { prefs -> prefs[INSTALLATION_ID] }
    val deploymentMode: Flow<String?> = context.dataStore.data.map { prefs -> prefs[DEPLOYMENT_MODE] }
    val maintenancePinHash: Flow<String?> = context.dataStore.data.map { prefs -> prefs[MAINTENANCE_PIN_HASH] }
    val maintenanceTimeoutMs: Flow<Long> = context.dataStore.data.map { prefs -> prefs[MAINTENANCE_TIMEOUT] ?: 60_000L }
    
    override val isRegistered: Flow<Boolean> = context.dataStore.data.map { prefs -> 
        !prefs[DEVICE_TOKEN].isNullOrBlank() && !prefs[DEVICE_ID].isNullOrBlank()
    }

    suspend fun saveDeviceCredentials(deviceIdStr: String, token: String, heartbeatInterval: Long, syncInterval: Long) {
        context.dataStore.edit { prefs ->
            prefs[DEVICE_ID] = deviceIdStr
            prefs[DEVICE_TOKEN] = token
            prefs[HEARTBEAT_INTERVAL] = heartbeatInterval
            prefs[REGISTRATION_TIMESTAMP] = System.currentTimeMillis()
        }
    }
    
    override suspend fun saveDeviceToken(token: String) {
        context.dataStore.edit { prefs ->
            prefs[DEVICE_TOKEN] = token
        }
    }
    
    suspend fun clearRegistration() {
        context.dataStore.edit { prefs ->
            prefs.remove(DEVICE_TOKEN)
            prefs.remove(DEVICE_ID)
            prefs.remove(REGISTRATION_TIMESTAMP)
        }
    }

    val heartbeatInterval: Flow<Long> = context.dataStore.data.map { it[HEARTBEAT_INTERVAL] ?: 15L }
    val playlistETag: Flow<String?> = context.dataStore.data.map { prefs -> prefs[PLAYLIST_ETAG] }
    
    suspend fun savePlaylistETag(etag: String) {
        context.dataStore.edit { prefs ->
            prefs[PLAYLIST_ETAG] = etag
        }
    }
    
    suspend fun getOrCreateInstallationId(generator: () -> String): String {
        var id: String? = null
        context.dataStore.edit { prefs ->
            id = prefs[INSTALLATION_ID]
            if (id == null) {
                id = generator()
                prefs[INSTALLATION_ID] = id!!
            }
        }
        return id!!
    }
}



