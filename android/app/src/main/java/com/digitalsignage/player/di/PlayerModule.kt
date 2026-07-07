package com.digitalsignage.player.di

import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import com.digitalsignage.player.domain.state.*
import com.digitalsignage.player.domain.orchestrator.*
import com.digitalsignage.player.domain.playback.*
import com.digitalsignage.player.player.playback.PlaybackControllerImpl

@Module
@InstallIn(SingletonComponent::class)
abstract class PlayerModule {
    
    @Binds
    abstract fun bindPlayerStateMachine(impl: PlayerStateMachineImpl): PlayerStateMachine
    
    @Binds
    abstract fun bindPlayerOrchestrator(impl: PlayerOrchestratorImpl): PlayerOrchestrator
    
    @Binds
    abstract fun bindPlaybackController(impl: PlaybackControllerImpl): PlaybackController
    
    // PlaybackController and PlaybackStateObserver would also be bound here
    @Binds
    abstract fun bindNetworkMonitor(impl: com.digitalsignage.player.core.network.NetworkMonitorImpl): com.digitalsignage.player.core.network.NetworkMonitor
    @Binds
    abstract fun bindRuntimeConfigStore(impl: com.digitalsignage.player.data.local.datastore.RuntimeConfigStoreImpl): com.digitalsignage.player.core.config.RuntimeConfigStore
        @Binds
    abstract fun bindPlaylistExecutor(impl: com.digitalsignage.player.domain.playback.executor.PlaylistExecutorImpl): com.digitalsignage.player.domain.playback.PlaylistExecutor
    }






