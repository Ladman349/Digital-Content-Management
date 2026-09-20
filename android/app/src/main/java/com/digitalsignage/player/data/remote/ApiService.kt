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
import retrofit2.http.Query

interface ApiService {
    @POST("devices/register")
    suspend fun registerDevice(@Body request: DeviceRegisterRequest): Response<DeviceRegisterResponse>

    @GET("devices/{deviceId}/current-playlist")
    suspend fun getPlaylist(
        @Path("deviceId") deviceId: String,
        @Header("If-None-Match") currentVersion: String? = null
    ): Response<okhttp3.ResponseBody>

    @POST("devices/heartbeat")
    suspend fun postHeartbeat(@Body payload: com.digitalsignage.player.data.remote.dto.HeartbeatPayload): Response<com.digitalsignage.player.data.remote.dto.HeartbeatReply>

    /** Answers a screenshot request from the CMS. The server refuses one it did not ask for. */
    @retrofit2.http.Multipart
    @POST("devices/{deviceId}/screenshot")
    suspend fun uploadScreenshot(
        @Path("deviceId") deviceId: String,
        @retrofit2.http.Part file: okhttp3.MultipartBody.Part
    ): Response<Unit>

    /** Proof of play: a batch of items this screen has shown. Safe to resend; the server de-duplicates by batch id. */
    @POST("devices/{deviceId}/plays")
    suspend fun postPlays(
        @Path("deviceId") deviceId: String,
        @Body payload: com.digitalsignage.player.data.remote.dto.PlayBatchPayload
    ): Response<Unit>

    @GET("app-updates/check")
    suspend fun checkForUpdate(
        @Query("version_code") versionCode: Int
    ): Response<com.digitalsignage.player.core.ota.model.AppUpdateCheckDto>
}

