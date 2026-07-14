package com.digitalsignage.player.core.ota.api

import com.digitalsignage.player.data.remote.ApiService
import com.digitalsignage.player.core.ota.model.AppUpdateCheckDto
import retrofit2.Response
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class OtaRepository @Inject constructor(
    private val apiService: ApiService
) {
    suspend fun checkForUpdate(versionCode: Int): Response<AppUpdateCheckDto> {
        return apiService.checkForUpdate(versionCode)
    }
}
