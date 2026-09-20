package com.digitalsignage.player.di

import android.content.Context
import androidx.room.Room
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton
import com.digitalsignage.player.data.local.AppDatabase
import com.digitalsignage.player.data.local.playlog.PlayLogDao
import com.digitalsignage.player.data.local.playlog.PlayLogDatabase

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {
    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): AppDatabase {
        // The database is a rebuildable cache of server state (playlists, media metadata,
        // download sessions). No Migration objects exist, so a schema bump must wipe and
        // resync in every build type instead of crashing release upgrades.
        return Room.databaseBuilder(context, AppDatabase::class.java, "digital_signage.db")
            .fallbackToDestructiveMigration()
            .build()
    }

    /**
     * Plays not yet reported to the server. A separate file so that wiping the cache database
     * above never loses them; no destructive fallback here for the same reason.
     */
    @Provides
    @Singleton
    fun providePlayLogDatabase(@ApplicationContext context: Context): PlayLogDatabase {
        return Room.databaseBuilder(context, PlayLogDatabase::class.java, "play_log.db").build()
    }

    @Provides
    fun providePlayLogDao(database: PlayLogDatabase): PlayLogDao = database.playLogDao()
}
