package com.digitalsignage.player.di

import com.digitalsignage.player.data.remote.ApiService
import com.digitalsignage.player.data.remote.AuthInterceptor
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

class NetworkTraceInterceptor : okhttp3.Interceptor {
    override fun intercept(chain: okhttp3.Interceptor.Chain): okhttp3.Response {
        val request = chain.request()
        android.util.Log.i("RegisterTrace", "[NetworkTrace] Outgoing Request: ${request.method} ${request.url}")
        try {
            val response = chain.proceed(request)
            android.util.Log.i("RegisterTrace", "[NetworkTrace] Incoming Response: Code=${response.code} for ${request.url}")
            return response
        } catch (e: Exception) {
            android.util.Log.e("RegisterTrace", "[NetworkTrace] Network Exception for ${request.url}", e)
            throw e
        }
    }
}

object LoggingDns : okhttp3.Dns {
    override fun lookup(hostname: String): List<java.net.InetAddress> {
        android.util.Log.i("RegisterTrace", "[DNSTrace] Resolving hostname: $hostname")
        try {
            val addresses = okhttp3.Dns.SYSTEM.lookup(hostname)
            android.util.Log.i("RegisterTrace", "[DNSTrace] Resolved $hostname to: ${addresses.map { it.hostAddress }}")
            return addresses
        } catch (e: Exception) {
            android.util.Log.e("RegisterTrace", "[DNSTrace] Resolution failed for $hostname", e)
            throw e
        }
    }
}

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideOkHttpClient(): OkHttpClient {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }
        return OkHttpClient.Builder()
            .addInterceptor(logging)
            .addInterceptor(NetworkTraceInterceptor())
            .addInterceptor(AuthInterceptor())
            .dns(LoggingDns)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient): Retrofit {
        android.util.Log.i("StartupTrace", "Trace: Retrofit creation started")
        android.util.Log.i("StartupTrace", "BASE_URL = ${com.digitalsignage.player.BuildConfig.BASE_URL}")
        
        val moshi = com.squareup.moshi.Moshi.Builder()
            .add(com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory())
            .build()
            
        return Retrofit.Builder()
            .baseUrl(com.digitalsignage.player.BuildConfig.BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build().also {
                android.util.Log.i("StartupTrace", "Trace: Retrofit creation finished")
            }
    }

    @Provides
    @Singleton
    fun provideApiService(retrofit: Retrofit): ApiService {
        android.util.Log.i("StartupTrace", "Trace: ApiService created")
        return retrofit.create(ApiService::class.java)
    }
}
