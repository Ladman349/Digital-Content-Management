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
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress

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
    override fun lookup(hostname: String): List<InetAddress> {
        android.util.Log.i("RegisterTrace", "[DNSTrace] Resolving hostname: $hostname")
        try {
            val addresses = okhttp3.Dns.SYSTEM.lookup(hostname)
            android.util.Log.i("RegisterTrace", "[DNSTrace] Resolved $hostname to: ${addresses.map { it.hostAddress }}")
            return addresses
        } catch (e: Exception) {
            android.util.Log.e("RegisterTrace", "[DNSTrace] System resolution failed for $hostname. Trying custom UDP fallbacks...", e)
            val fallbacks = listOf("8.8.8.8", "1.1.1.1")
            for (dns in fallbacks) {
                try {
                    val resolvedIps = resolveDnsOverUdp(hostname, dns)
                    if (resolvedIps.isNotEmpty()) {
                        val addresses = resolvedIps.map { InetAddress.getByName(it) }
                        android.util.Log.i("RegisterTrace", "[DNSTrace] Custom UDP Resolver ($dns) resolved $hostname to: ${addresses.map { it.hostAddress }}")
                        return addresses
                    }
                } catch (ex: Exception) {
                    android.util.Log.e("RegisterTrace", "[DNSTrace] Custom UDP Resolver ($dns) failed for $hostname", ex)
                }
            }
            throw e
        }
    }

    private fun resolveDnsOverUdp(domain: String, dnsServerIp: String): List<String> {
        val ips = mutableListOf<String>()
        val socket = DatagramSocket()
        socket.soTimeout = 5000
        try {
            val serverAddr = InetAddress.getByName(dnsServerIp)
            val query = ByteArrayOutputStream()
            val out = DataOutputStream(query)
            
            out.writeShort(0x1234)
            out.writeShort(0x0100)
            out.writeShort(0x0001)
            out.writeShort(0x0000)
            out.writeShort(0x0000)
            out.writeShort(0x0000)
            
            val parts = domain.split(".")
            for (part in parts) {
                val bytes = part.toByteArray(Charsets.UTF_8)
                out.writeByte(bytes.size)
                out.write(bytes)
            }
            out.writeByte(0x00)
            
            out.writeShort(0x0001)
            out.writeShort(0x0001)
            
            val sendData = query.toByteArray()
            val sendPacket = DatagramPacket(sendData, sendData.size, serverAddr, 53)
            socket.send(sendPacket)
            
            val recvData = ByteArray(1024)
            val recvPacket = DatagramPacket(recvData, recvData.size)
            socket.receive(recvPacket)
            
            val bin = ByteArrayInputStream(recvData)
            val din = DataInputStream(bin)
            
            val txId = din.readUnsignedShort()
            val flags = din.readUnsignedShort()
            val questions = din.readUnsignedShort()
            val answers = din.readUnsignedShort()
            val authority = din.readUnsignedShort()
            val additional = din.readUnsignedShort()
            
            for (i in 0 until questions) {
                var length = din.readUnsignedByte()
                while (length > 0) {
                    if ((length and 0xC0) == 0xC0) {
                        din.readUnsignedByte()
                        break
                    }
                    for (j in 0 until length) {
                        din.readByte()
                    }
                    length = din.readUnsignedByte()
                }
                val qtype = din.readUnsignedShort()
                val qclass = din.readUnsignedShort()
            }
            
            for (i in 0 until answers) {
                var length = din.readUnsignedByte()
                while (length > 0) {
                    if ((length and 0xC0) == 0xC0) {
                        din.readUnsignedByte()
                        break
                    }
                    for (j in 0 until length) {
                        din.readByte()
                    }
                    length = din.readUnsignedByte()
                }
                val type = din.readUnsignedShort()
                val clazz = din.readUnsignedShort()
                val ttl = din.readInt()
                val rdLength = din.readUnsignedShort()
                
                if (type == 0x0001 && rdLength == 4) {
                    val ipBytes = ByteArray(4)
                    din.readFully(ipBytes)
                    val ip = InetAddress.getByAddress(ipBytes).hostAddress
                    if (ip != null) ips.add(ip)
                } else {
                    for (j in 0 until rdLength) {
                        din.readByte()
                    }
                }
            }
        } catch (e: Exception) {
            throw e
        } finally {
            socket.close()
        }
        return ips
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
