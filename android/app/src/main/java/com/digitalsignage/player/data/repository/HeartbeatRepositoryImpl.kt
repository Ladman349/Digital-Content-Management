package com.digitalsignage.player.data.repository

import com.digitalsignage.player.core.error.AppError
import com.digitalsignage.player.core.health.DeviceHealthCollector
import com.digitalsignage.player.core.logging.Logger
import com.digitalsignage.player.data.local.datastore.RuntimeConfigStoreImpl
import com.digitalsignage.player.data.remote.ApiService
import com.digitalsignage.player.domain.repository.HeartbeatRepository
import com.digitalsignage.player.domain.repository.Result
import kotlinx.coroutines.flow.firstOrNull
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class HeartbeatRepositoryImpl @Inject constructor(
    private val apiService: ApiService,
    private val healthCollector: DeviceHealthCollector,
    private val configStore: RuntimeConfigStoreImpl,
    private val logger: Logger
) : HeartbeatRepository {

    override suspend fun sendHeartbeat(): Result<Unit> {
        return try {
            val deviceId = configStore.deviceId.firstOrNull()
            if (deviceId.isNullOrEmpty()) {
                logger.e("HeartbeatRepository", "No device ID found. Skipping heartbeat.")
                return Result.Error(AppError.Recoverable("Unregistered device"))
            }

            val payload = healthCollector.collectHealthData(deviceId)
            
            logger.d("HeartbeatRepository", "Sending heartbeat payload: ${payload}")
            val response = apiService.postHeartbeat(payload)

            if (response.isSuccessful) {
                logger.d("HeartbeatRepository", "Heartbeat sent successfully.")
                Result.Success(Unit)
            } else if (response.code() == 401 || response.code() == 404) {
                logger.e("HeartbeatRepository", "Device not found or unauthorized on heartbeat: ${response.code()}")
                Result.Error(AppError.Recoverable("Device unauthorized or not found: ${response.code()}"))
            } else {
                logger.e("HeartbeatRepository", "Heartbeat failed with code: ${response.code()}")
                Result.Error(AppError.Retryable("HTTP Error ${response.code()}"))
            }
        } catch (e: Exception) {
            logger.e("HeartbeatRepository", "Network exception sending heartbeat", e)
            Result.Error(AppError.Retryable("Network Exception", e))
        }
    }
}
