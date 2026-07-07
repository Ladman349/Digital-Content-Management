package com.digitalsignage.player.di

import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import com.digitalsignage.player.domain.repository.*
import com.digitalsignage.player.core.logging.Logger
import com.digitalsignage.player.core.logging.AndroidLogger
import com.digitalsignage.player.data.repository.*

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {
    @Binds abstract fun bindLogger(impl: AndroidLogger): Logger
    @Binds abstract fun bindDeviceRepository(impl: DeviceRepositoryImpl): DeviceRepository
    @Binds abstract fun bindPlaylistRepository(impl: PlaylistRepositoryImpl): PlaylistRepository
    // @Binds abstract fun bindMediaRepository(impl: MediaRepositoryImpl): MediaRepository
    @Binds abstract fun bindHeartbeatRepository(impl: HeartbeatRepositoryImpl): HeartbeatRepository
    // @Binds abstract fun bindSettingsRepository(impl: SettingsRepositoryImpl): SettingsRepository
}


