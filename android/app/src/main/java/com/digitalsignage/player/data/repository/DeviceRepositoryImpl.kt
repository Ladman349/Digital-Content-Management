package com.digitalsignage.player.data.repository

import com.digitalsignage.player.core.error.AppError
import com.digitalsignage.player.core.identity.DeviceIdentityManager
import com.digitalsignage.player.core.logging.Logger
import com.digitalsignage.player.data.local.datastore.RuntimeConfigStoreImpl
import com.digitalsignage.player.domain.registration.RegistrationState
import com.digitalsignage.player.domain.repository.DeviceRepository
import com.digitalsignage.player.domain.repository.Result
import com.digitalsignage.player.data.remote.ApiService
import com.digitalsignage.player.data.remote.dto.DeviceRegisterRequest
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.firstOrNull
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DeviceRepositoryImpl @Inject constructor(
    private val apiService: ApiService,
    private val runtimeConfigStore: RuntimeConfigStoreImpl,
    private val identityManager: DeviceIdentityManager,
    private val logger: Logger
) : DeviceRepository { 

    private val _registrationState = MutableStateFlow(RegistrationState.Unregistered)

    override suspend fun registerDevice(): Result<Boolean> {
        android.util.Log.i("RegisterTrace", "[Startup] Starting device registration process. BASE_URL=${com.digitalsignage.player.BuildConfig.BASE_URL}")
        android.util.Log.i("InvestigateReg", "4. DeviceRepositoryImpl.registerDevice() entered")
        android.util.Log.i("StartupTrace", "Trace: DeviceRepositoryImpl.registerDevice() started")
        android.util.Log.i("NetworkTrace", "Attempting registration against BASE_URL: ${com.digitalsignage.player.BuildConfig.BASE_URL}")
        _registrationState.value = RegistrationState.Registering
        return try {
            val installId = runtimeConfigStore.getOrCreateInstallationId { identityManager.generateAppInstallationId() }
            val metadata = identityManager.getDeviceMetadata()
            
            android.util.Log.i("RegisterTrace", "[Startup] Retrieved installation ID: $installId")
            android.util.Log.i("RegisterTrace", "[Startup] Retrieved device metadata: Android ID=${metadata.androidId}, Manufacturer=${metadata.manufacturer}, Model=${metadata.model}, AppVersion=${metadata.appVersion}, ScreenResolution=${metadata.screenResolution}")
            logger.i("DeviceRepository", "Attempting idempotent registration for UUID: ${installId}")
            
            val request = DeviceRegisterRequest(
                name = "${metadata.manufacturer} ${metadata.model} (${metadata.androidId})",
                resolution = metadata.screenResolution,
                ipAddress = null,
                appVersion = metadata.appVersion,
                androidId = metadata.androidId
            )
            
            android.util.Log.i("RegisterTrace", "[Request] Created registration request payload: name=${request.name}, resolution=${request.resolution}, appVersion=${request.appVersion}, androidId=${request.androidId}")
            android.util.Log.i("InvestigateReg", "5. Immediately before Retrofit apiService.registerDevice(request) is invoked.")
            android.util.Log.i("RegisterTrace", "[Retrofit] Executing API registration call...")
            
            val response = apiService.registerDevice(request)
            android.util.Log.i("InvestigateReg", "6. Immediately after Retrofit returns. Success? ${response.isSuccessful}")
            android.util.Log.i("RegisterTrace", "[Retrofit] API registration response code: ${response.code()}, message: ${response.message()}")
            
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                android.util.Log.i("RegisterTrace", "[Retrofit] API registration succeeded. Response Body: deviceId=${body.deviceId}, token=${body.deviceToken}, syncInterval=${body.syncInterval}")
                runtimeConfigStore.saveDeviceCredentials(
                    deviceIdStr = body.deviceId,
                    token = body.deviceToken,
                    heartbeatInterval = body.heartbeatInterval.toLong(),
                    syncInterval = body.syncInterval.toLong()
                )
                _registrationState.value = RegistrationState.Registered
                Result.Success(true)
            } else {
                val errorBodyStr = response.errorBody()?.string()
                android.util.Log.w("RegisterTrace", "[Retrofit] API registration failed. Code: ${response.code()}, Message: ${response.message()}, Error Body: $errorBodyStr")
                _registrationState.value = RegistrationState.RegistrationFailed
                if (response.code() == 401 || response.code() == 404) {
                    Result.Error(AppError.Recoverable("Registration failed: ${response.code()} $errorBodyStr"))
                } else {
                    Result.Error(AppError.Retryable("API returned unauthorized or failed: ${response.code()} $errorBodyStr"))
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("RegisterTrace", "[Exception] Device registration threw an exception", e)
            android.util.Log.e("RegisterTrace", "[Exception] Exception Class: ${e::class.java.name}, Message: ${e.message}, Cause: ${e.cause?.message}")
            android.util.Log.e("NetworkTrace", "Exception Class: ${e::class.java.name}")
            android.util.Log.e("NetworkTrace", "Exception Message: ${e.message}")
            android.util.Log.e("NetworkTrace", "Stack Trace: ", e)
            if (e.cause != null) {
                android.util.Log.e("NetworkTrace", "Cause", e.cause)
            }
            _registrationState.value = RegistrationState.RegistrationFailed
            
            if (com.digitalsignage.player.BuildConfig.DEBUG) {
                val sw = java.io.StringWriter()
                e.printStackTrace(java.io.PrintWriter(sw))
                val causeMsg = e.cause?.let { "${it::class.java.name}: ${it.message}" }
                Result.Error(AppError.DebugException(
                    messageStr = "Startup failed",
                    exceptionClass = e::class.java.name,
                    exceptionMessage = e.message ?: "No message",
                    stackTrace = sw.toString(),
                    causeMessage = causeMsg
                ))
            } else {
                Result.Error(AppError.Retryable("Network or Server error during registration", e))
            }
        }
    }
    
    suspend fun clearRegistration() {
        runtimeConfigStore.clearRegistration()
    }
    
    override fun observeRegistrationState(): Flow<Boolean> = runtimeConfigStore.isRegistered
    
    suspend fun validateLocalCredentials(): Boolean {
        android.util.Log.i("StartupTrace", "Trace: DeviceRepositoryImpl.validateLocalCredentials() started")
        val token = runtimeConfigStore.deviceToken.firstOrNull()
        android.util.Log.i("StartupTrace", "Trace: DeviceRepositoryImpl.validateLocalCredentials() token=$token")
        return if (!token.isNullOrBlank()) {
            _registrationState.value = RegistrationState.Registered
            true
        } else {
            _registrationState.value = RegistrationState.Unregistered
            false
        }
    }
}

