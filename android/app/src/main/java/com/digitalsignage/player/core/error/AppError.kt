package com.digitalsignage.player.core.error

sealed class AppError : Exception() {
    abstract val messageStr: String
    
    // Errors that can be resolved automatically by retrying the operation
    data class Retryable(override val messageStr: String, val causeException: Exception? = null) : AppError()
    
    // Errors that require fallback behavior (e.g., skip media, go offline) but don't crash the app
    data class Recoverable(override val messageStr: String, val causeException: Exception? = null) : AppError()
    
    // Critical errors that require a full application restart
    data class Fatal(override val messageStr: String, val causeException: Exception? = null) : AppError()

    // Debugging exception for displaying raw errors on screen
    data class DebugException(
        override val messageStr: String,
        val exceptionClass: String,
        val exceptionMessage: String,
        val stackTrace: String,
        val causeMessage: String?
    ) : AppError()
}
