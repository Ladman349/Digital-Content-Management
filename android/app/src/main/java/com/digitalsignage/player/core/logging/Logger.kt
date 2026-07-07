package com.digitalsignage.player.core.logging

import com.digitalsignage.player.BuildConfig

interface Logger {
    fun d(tag: String, message: String)
    fun i(tag: String, message: String)
    fun w(tag: String, message: String)
    fun e(tag: String, message: String, throwable: Throwable? = null)
    
    // Structured Event Logging
    fun logEvent(eventName: String, payload: Map<String, Any> = emptyMap())
}

class AndroidLogger @javax.inject.Inject constructor() : Logger {
    
    private val sensitiveKeys = setOf(
        "pin", "token", "password", "hash", 
        "authorization", "bearer", "secret", "apikey", "refreshtoken"
    )

    override fun d(tag: String, message: String) { 
        if (BuildConfig.DEBUG) {
            android.util.Log.d(tag, message) 
        }
    }
    
    override fun i(tag: String, message: String) { 
        android.util.Log.i(tag, message) 
    }
    
    override fun w(tag: String, message: String) { 
        android.util.Log.w(tag, message) 
    }
    
    override fun e(tag: String, message: String, throwable: Throwable?) {
        if (throwable != null) android.util.Log.e(tag, message, throwable) else android.util.Log.e(tag, message)
    }
    
    override fun logEvent(eventName: String, payload: Map<String, Any>) {
        val sanitizedPayload = payload.mapValues { (key, value) ->
            if (sensitiveKeys.any { key.lowercase().contains(it) }) {
                "***REDACTED***"
            } else {
                value
            }
        }
        android.util.Log.i("Event-${eventName}", sanitizedPayload.toString())
    }
}

