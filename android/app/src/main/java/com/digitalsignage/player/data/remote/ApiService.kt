package com.digitalsignage.player.data.remote

import com.digitalsignage.player.data.remote.dto.PlaylistSyncResponse
import com.digitalsignage.player.data.remote.dto.DeviceRegisterRequest
import com.digitalsignage.player.data.remote.dto.DeviceRegisterResponse
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Header
import retrofit2.http.Body
import retrofit2.http.Path

interface ApiService {
    @POST("devices/register")
    suspend fun registerDevice(@Body request: DeviceRegisterRequest): Response<DeviceRegisterResponse>

    @GET("devices/{deviceId}/current-playlist")
    suspend fun getPlaylist(
        @Path("deviceId") deviceId: String,
        @Header("If-None-Match") currentVersion: String? = null
    ): Response<okhttp3.ResponseBody>

    @POST("devices/heartbeat")
    suspend fun postHeartbeat(@Body payload: com.digitalsignage.player.data.remote.dto.HeartbeatPayload): Response<Unit>
}

