package com.digitalsignage.player.data.local.playlog

import androidx.room.ColumnInfo
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Index
import androidx.room.Insert
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.RoomDatabase

/**
 * One item shown on screen, waiting to be reported as proof of play.
 *
 * [batchId] is null until the first attempt to send the row. It is then fixed, so a retry after a
 * lost reply sends exactly the same rows under the same id and the server counts them once.
 */
@Entity(tableName = "play_log", indices = [Index("batchId")])
data class PlayLogEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val mediaId: String,
    val playlistId: String?,
    /** Wall-clock start, epoch milliseconds. The server corrects for a wrong device clock. */
    val startedAt: Long,
    val durationMs: Long,
    val completed: Boolean,
    @ColumnInfo(defaultValue = "NULL") val batchId: String? = null
)

@Dao
interface PlayLogDao {
    @Insert
    suspend fun insert(entry: PlayLogEntity)

    @Query("SELECT COUNT(*) FROM play_log")
    suspend fun count(): Int

    /** The oldest batch that was attempted and never confirmed, if any. */
    @Query("SELECT batchId FROM play_log WHERE batchId IS NOT NULL ORDER BY id ASC LIMIT 1")
    suspend fun oldestPendingBatchId(): String?

    @Query("SELECT * FROM play_log WHERE batchId = :batchId ORDER BY id ASC")
    suspend fun entriesInBatch(batchId: String): List<PlayLogEntity>

    @Query("UPDATE play_log SET batchId = :batchId WHERE id IN (SELECT id FROM play_log WHERE batchId IS NULL ORDER BY id ASC LIMIT :limit)")
    suspend fun claimOldest(batchId: String, limit: Int): Int

    @Query("DELETE FROM play_log WHERE batchId = :batchId")
    suspend fun deleteBatch(batchId: String)

    @Query("DELETE FROM play_log WHERE id IN (SELECT id FROM play_log ORDER BY id ASC LIMIT :count)")
    suspend fun deleteOldest(count: Int)
}

/**
 * Kept apart from [com.digitalsignage.player.data.local.AppDatabase] on purpose. That database is a
 * rebuildable cache and is wiped whenever its schema changes; this one holds the only copy of plays
 * that have not reached the server yet, and must survive that.
 */
@Database(entities = [PlayLogEntity::class], version = 1, exportSchema = false)
abstract class PlayLogDatabase : RoomDatabase() {
    abstract fun playLogDao(): PlayLogDao
}
