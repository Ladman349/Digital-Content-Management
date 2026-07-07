package com.digitalsignage.player.di

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
import com.digitalsignage.player.data.remote.ApiService
import com.digitalsignage.player.data.remote.AuthInterceptor

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideOkHttpClient(eventBus: com.digitalsignage.player.core.event.PlayerEventBus): OkHttpClient {
        val customLogger = HttpLoggingInterceptor.Logger { message -> 
            android.util.Log.i("InvestigateReg", "9. OkHttp: $message")
        }
        val logging = HttpLoggingInterceptor(customLogger).apply { level = HttpLoggingInterceptor.Level.BODY }
        return OkHttpClient.Builder()
            .addInterceptor(logging)
            .addInterceptor(AuthInterceptor())
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient): Retrofit {
        android.util.Log.i("StartupTrace", "Trace: Retrofit creation started")
        
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
