package com.digitalsignage.player.data.local

import androidx.room.TypeConverter
import com.digitalsignage.player.domain.model.DownloadState
import com.digitalsignage.player.domain.model.PlaylistState

class Converters {
    @TypeConverter
    fun fromPlaylistState(state: PlaylistState): String = state.name
    @TypeConverter
    fun toPlaylistState(name: String): PlaylistState = PlaylistState.valueOf(name)
    
    @TypeConverter
    fun fromDownloadState(state: DownloadState): String = state.name
    @TypeConverter
    fun toDownloadState(name: String): DownloadState = DownloadState.valueOf(name)
}
