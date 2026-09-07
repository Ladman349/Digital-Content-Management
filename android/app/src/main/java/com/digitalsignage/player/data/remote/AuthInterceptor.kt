package com.digitalsignage.player.data.remote

import com.digitalsignage.player.data.local.datastore.RuntimeConfigStoreImpl
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Attaches the stored device token as a Bearer header. When the device has not registered yet
 * no Authorization header is sent at all.
 */
@Singleton
class AuthInterceptor @Inject constructor(
    private val runtimeConfigStore: RuntimeConfigStoreImpl
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = runtimeConfigStore.cachedDeviceToken
        if (token.isNullOrBlank()) {
            return chain.proceed(chain.request())
        }
        val request = chain.request().newBuilder()
            .header("Authorization", "Bearer $token")
            .build()
        return chain.proceed(request)
    }
}
