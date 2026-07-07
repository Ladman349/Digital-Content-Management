package com.digitalsignage.player

import com.digitalsignage.player.data.remote.dto.PlaylistSyncResponse
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import org.junit.Test
import org.junit.Assert.*

class MoshiTest {
    @Test
    fun testMoshiAdapterCreation() {
        try {
            val moshi = Moshi.Builder()
                .add(KotlinJsonAdapterFactory())
                .build()
            
            println("Creating adapter...")
            val adapter = moshi.adapter(PlaylistSyncResponse::class.java)
            println("Adapter created successfully!")
            
            val json = """
                {
                  "playlistId": "test-id",
                  "playlistName": "Test Playlist",
                  "playlistVersion": 1,
                  "updatedAt": 1234567890,
                  "items": [
                    {
                      "id": "item-id",
                      "mediaId": "media-id",
                      "order": 1,
                      "duration": 5000,
                      "media": {
                        "mediaId": "media-id",
                        "name": "Test Video",
                        "type": "video",
                        "size": 1024,
                        "duration": 5000,
                        "downloadUrl": "http://example.com/video.mp4",
                        "checksum": "abcdef"
                      }
                    }
                  ]
                }
            """.trimIndent()
            
            println("Parsing JSON...")
            val data = adapter.fromJson(json)
            println("Parsed successfully: ${data}")
            
        } catch (e: Exception) {
            println("EXCEPTION THROWN: ${e::class.java.name}")
            e.printStackTrace()
            throw e
        }
    }
}
