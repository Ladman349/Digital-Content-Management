package com.digitalsignage.player.repository

import com.digitalsignage.player.player.DeviceCapabilities
import com.digitalsignage.player.player.HealthSnapshot
import com.digitalsignage.player.player.RuntimeSnapshot

/**
 * Single source of truth for all runtime device information.
 * Used to isolate PlaybackController from HeartbeatWorker.
 */
class DeviceStateRepository {
    
    private var currentRuntimeSnapshot: RuntimeSnapshot? = null
    private var currentHealthSnapshot: HealthSnapshot? = null
    private var currentDeviceCapabilities: DeviceCapabilities? = null
    
    private var heartbeatSequence: Long = 0

    // Using synchronized to ensure thread safety when reading/writing from multiple threads 
    // (e.g. WorkManager threads vs Main Thread)
    
    @Synchronized
    fun updateRuntimeSnapshot(snapshot: RuntimeSnapshot) {
        this.currentRuntimeSnapshot = snapshot
    }

    @Synchronized
    fun updateHealthSnapshot(snapshot: HealthSnapshot) {
        this.currentHealthSnapshot = snapshot
    }

    @Synchronized
    fun updateDeviceCapabilities(capabilities: DeviceCapabilities) {
        this.currentDeviceCapabilities = capabilities
    }

    @Synchronized
    fun getRuntimeSnapshot(): RuntimeSnapshot? {
        return currentRuntimeSnapshot
    }

    @Synchronized
    fun getHealthSnapshot(): HealthSnapshot? {
        return currentHealthSnapshot
    }

    @Synchronized
    fun getDeviceCapabilities(): DeviceCapabilities? {
        return currentDeviceCapabilities
    }

    @Synchronized
    fun getNextSequenceNumber(): Long {
        return ++heartbeatSequence
    }
}
