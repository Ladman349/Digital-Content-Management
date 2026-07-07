package com.digitalsignage.player.ui

import android.app.Dialog
import android.content.Context
import android.os.Bundle
import android.view.Window
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import com.digitalsignage.player.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.cancel
import java.security.MessageDigest
import com.digitalsignage.player.data.local.datastore.RuntimeConfigStoreImpl

class MaintenanceDialog(
    context: Context,
    private val dataStore: RuntimeConfigStoreImpl,
    private val onSuccess: () -> Unit
) : Dialog(context) {
    private val scope = CoroutineScope(kotlinx.coroutines.SupervisorJob() + Dispatchers.Main)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestWindowFeature(Window.FEATURE_NO_TITLE)
        setContentView(R.layout.dialog_maintenance)
        
        val etPin = findViewById<EditText>(R.id.etPin)
        val btnSubmit = findViewById<Button>(R.id.btnSubmit)
        val tvError = findViewById<TextView>(R.id.tvError)

        btnSubmit.setOnClickListener {
            val enteredPin = etPin.text.toString()
            scope.launch {
                val storedHash = withContext(Dispatchers.IO) { dataStore.maintenancePinHash.first() }
                val enteredHash = withContext(Dispatchers.IO) { hashPin(enteredPin) }
                
                if (storedHash == null) {
                    tvError.text = "PIN not provisioned"
                    etPin.text.clear()
                } else if (storedHash == enteredHash) {
                    dismiss()
                    onSuccess()
                } else {
                    tvError.text = "Invalid PIN"
                    etPin.text.clear()
                }
            }
        }
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
