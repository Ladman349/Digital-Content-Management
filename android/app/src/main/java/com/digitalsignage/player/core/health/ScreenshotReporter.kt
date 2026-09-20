package com.digitalsignage.player.core.health

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.PixelCopy
import android.view.TextureView
import android.view.View
import android.view.ViewGroup
import com.digitalsignage.player.core.logging.Logger
import com.digitalsignage.player.data.remote.ApiService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.ByteArrayOutputStream
import java.lang.ref.WeakReference
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume

/**
 * Answers the CMS's "show me what this screen is showing". Nothing is ever captured unless the
 * heartbeat reply asks for it, and the picture goes nowhere but the signage backend.
 *
 * A screenshot is a convenience; playback is the job. Every failure here, an out-of-memory error
 * included, is swallowed and logged at warning level so that it can neither stop playback nor
 * show up as the screen's "last error".
 */
@Singleton
class ScreenshotReporter @Inject constructor(
    private val apiService: ApiService,
    private val logger: Logger
) {
    private companion object {
        const val TAG = "ScreenshotReporter"
        /** Plenty to see what is on screen, and a few tens of kilobytes on the wire. */
        const val MAX_WIDTH = 960
        const val JPEG_QUALITY = 70
        const val CAPTURE_TIMEOUT_MS = 5_000L
    }

    private var activityRef: WeakReference<Activity>? = null
    private val inFlight = Mutex()

    fun attach(activity: Activity) {
        activityRef = WeakReference(activity)
    }

    fun detach(activity: Activity) {
        if (activityRef?.get() === activity) activityRef = null
    }

    suspend fun captureAndUpload(deviceId: String) {
        if (!inFlight.tryLock()) return
        try {
            val jpeg = capture() ?: return
            val part = MultipartBody.Part.createFormData("file", "screen.jpg", jpeg.toRequestBody("image/jpeg".toMediaType()))
            val response = apiService.uploadScreenshot(deviceId, part)
            if (response.isSuccessful) logger.i(TAG, "Screenshot delivered (${jpeg.size / 1024} KB)")
            else logger.w(TAG, "Screenshot was not accepted: HTTP ${response.code()}")
        } catch (t: Throwable) {
            logger.w(TAG, "Screenshot failed: ${t.javaClass.simpleName}: ${t.message}")
        } finally {
            inFlight.unlock()
        }
    }

    private suspend fun capture(): ByteArray? {
        val full = withContext(Dispatchers.Main) {
            val activity = activityRef?.get()
            if (activity == null || activity.isFinishing || activity.isDestroyed) {
                logger.w(TAG, "No playback window to capture")
                return@withContext null
            }
            val root = activity.window.decorView
            if (root.width <= 0 || root.height <= 0) return@withContext null
            val bitmap = Bitmap.createBitmap(root.width, root.height, Bitmap.Config.ARGB_8888)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                // Copies what the compositor shows, hardware-rendered video included.
                val ok = withTimeoutOrNull(CAPTURE_TIMEOUT_MS) {
                    suspendCancellableCoroutine<Boolean> { continuation ->
                        PixelCopy.request(activity.window, bitmap, { result ->
                            if (continuation.isActive) continuation.resume(result == PixelCopy.SUCCESS)
                        }, Handler(Looper.getMainLooper()))
                    }
                }
                if (ok != true) {
                    bitmap.recycle()
                    return@withContext null
                }
            } else {
                // Older Android: draw the view tree, then lay the video frame over the hole it leaves.
                val canvas = Canvas(bitmap)
                root.draw(canvas)
                findTextureView(root)?.let { video ->
                    video.bitmap?.let { frame ->
                        val at = IntArray(2)
                        video.getLocationInWindow(at)
                        canvas.drawBitmap(frame, at[0].toFloat(), at[1].toFloat(), null)
                        frame.recycle()
                    }
                }
            }
            bitmap
        } ?: return null

        return withContext(Dispatchers.Default) {
            val scaled = if (full.width > MAX_WIDTH) {
                Bitmap.createScaledBitmap(full, MAX_WIDTH, (full.height.toLong() * MAX_WIDTH / full.width).toInt().coerceAtLeast(1), true)
            } else full
            val out = ByteArrayOutputStream()
            scaled.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, out)
            if (scaled !== full) scaled.recycle()
            full.recycle()
            out.toByteArray()
        }
    }

    private fun findTextureView(view: View): TextureView? {
        if (view is TextureView && view.isAvailable && view.visibility == View.VISIBLE) return view
        if (view is ViewGroup) {
            for (i in 0 until view.childCount) findTextureView(view.getChildAt(i))?.let { return it }
        }
        return null
    }
}
