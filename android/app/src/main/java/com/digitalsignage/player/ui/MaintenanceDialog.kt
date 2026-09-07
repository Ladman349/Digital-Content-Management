package com.digitalsignage.player.ui

import android.app.Dialog
import android.content.Context
import android.os.Bundle
import android.view.View
import android.view.Window
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import com.digitalsignage.player.R
import com.digitalsignage.player.data.local.datastore.RuntimeConfigStoreImpl
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.security.MessageDigest

class MaintenanceDialog(
    context: Context,
    private val dataStore: RuntimeConfigStoreImpl,
    private val onSuccess: () -> Unit
) : Dialog(context, R.style.Theme_DigitalSignage_Dialog) {

    private companion object {
        const val MIN_PIN_LENGTH = 4
        const val MAX_PIN_LENGTH = 8
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestWindowFeature(Window.FEATURE_NO_TITLE)
        setContentView(R.layout.dialog_maintenance)

        val etPin = findViewById<EditText>(R.id.etPin)
        val btnSubmit = findViewById<Button>(R.id.btnSubmit)
        val btnCancel = findViewById<Button>(R.id.btnCancel)
        val tvError = findViewById<TextView>(R.id.tvError)

        fun showError(resId: Int) {
            tvError.setText(resId)
            tvError.visibility = View.VISIBLE
        }

        fun clearError() {
            tvError.text = ""
            tvError.visibility = View.INVISIBLE
        }

        btnCancel.setOnClickListener { this@MaintenanceDialog.cancel() }

        btnSubmit.setOnClickListener {
            val enteredPin = etPin.text.toString()
            if (enteredPin.length !in MIN_PIN_LENGTH..MAX_PIN_LENGTH) {
                showError(R.string.maintenance_error_too_short)
                return@setOnClickListener
            }
            clearError()
            scope.launch {
                val storedHash = withContext(Dispatchers.IO) { dataStore.maintenancePinHash.first() }
                val enteredHash = withContext(Dispatchers.Default) { hashPin(enteredPin) }

                when {
                    storedHash == null -> {
                        showError(R.string.maintenance_error_not_provisioned)
                        etPin.text.clear()
                    }
                    storedHash == enteredHash -> {
                        dismiss()
                        onSuccess()
                    }
                    else -> {
                        showError(R.string.maintenance_error_invalid_pin)
                        etPin.text.clear()
                    }
                }
            }
        }

        etPin.requestFocus()
    }

    override fun onStop() {
        super.onStop()
        scope.cancel()
    }

    private fun hashPin(pin: String): String {
        val bytes = MessageDigest.getInstance("SHA-256").digest(pin.toByteArray())
        return bytes.joinToString("") { "%02x".format(it) }
    }
}
