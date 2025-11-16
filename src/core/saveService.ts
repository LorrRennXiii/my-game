/**
 * Industrial-Standard Game Save Service
 * 
 * Features:
 * - Database-backed persistent saves
 * - Multiple save slots per user
 * - Save metadata (character info, playtime, timestamps)
 * - Auto-save functionality
 * - Save validation and versioning
 * - Save compression for large game states
 */

import { Pool, type PoolClient } from 'pg'
import type { SaveData } from './saveLoad.js'

export interface SaveMetadata {
  saveId: string
  userId: string // Session ID or user ID
  slotNumber: number // 1-10 for save slots
  saveName: string // User-friendly name
  characterName: string
  characterLevel: number
  characterTribe: string
  day: number
  playtime: number // Total playtime in seconds
  timestamp: number // Unix timestamp
  isAutoSave: boolean
  version: string // Save format version for compatibility
  thumbnail?: string // Base64 encoded thumbnail (optional)
}

export interface SaveSlot {
  slotNumber: number
  metadata: SaveMetadata | null
  isEmpty: boolean
}

export class SaveService {
  private pool: Pool

  constructor() {
    const connectionString = process.env.DATABASE_URL || 
      `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'three_tribes_chronicle'}`
    
    this.pool = new Pool({
      connectionString,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })

    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err)
    })
  }

  async initialize(): Promise<void> {
    const client = await this.pool.connect()
    try {
      // Create game_saves table
      await client.query(`
        CREATE TABLE IF NOT EXISTS game_saves (
          id SERIAL PRIMARY KEY,
          save_id VARCHAR(255) UNIQUE NOT NULL,
          user_id VARCHAR(255) NOT NULL,
          slot_number INTEGER NOT NULL,
          save_name VARCHAR(255) NOT NULL,
          character_name VARCHAR(255) NOT NULL,
          character_level INTEGER NOT NULL,
          character_tribe VARCHAR(100) NOT NULL,
          day INTEGER NOT NULL,
          playtime INTEGER NOT NULL DEFAULT 0,
          is_auto_save BOOLEAN NOT NULL DEFAULT false,
          version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
          save_data JSONB NOT NULL,
          metadata JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_user_slot UNIQUE (user_id, slot_number)
        )
      `)

      // Create indexes for performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_user_id ON game_saves(user_id)
      `)

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_save_id ON game_saves(save_id)
      `)

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_user_slot ON game_saves(user_id, slot_number)
      `)

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_updated_at ON game_saves(updated_at DESC)
      `)

      console.log('✅ Save service initialized successfully')
    } finally {
      client.release()
    }
  }

  /**
   * Save game to a specific slot
   */
  async saveGame(
    userId: string,
    slotNumber: number,
    saveData: SaveData,
    saveName?: string,
    isAutoSave: boolean = false,
    playtime: number = 0
  ): Promise<SaveMetadata> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')

      // Generate save ID
      const saveId = `save_${userId}_${slotNumber}_${Date.now()}`

      // Extract metadata from save data
      const metadata: SaveMetadata = {
        saveId,
        userId,
        slotNumber,
        saveName: saveName || `Save Slot ${slotNumber}`,
        characterName: saveData.player.name,
        characterLevel: saveData.player.level,
        characterTribe: saveData.player.tribe,
        day: saveData.day,
        playtime,
        timestamp: Date.now(),
        isAutoSave,
        version: '1.0.0'
      }

      // Compress save data (optional - can be enabled for large saves)
      const compressedData = this.compressSaveData(saveData)

      // Insert or update save
      await client.query(
        `INSERT INTO game_saves (
          save_id, user_id, slot_number, save_name,
          character_name, character_level, character_tribe,
          day, playtime, is_auto_save, version, save_data, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (user_id, slot_number)
        DO UPDATE SET
          save_id = EXCLUDED.save_id,
          save_name = EXCLUDED.save_name,
          character_name = EXCLUDED.character_name,
          character_level = EXCLUDED.character_level,
          character_tribe = EXCLUDED.character_tribe,
          day = EXCLUDED.day,
          playtime = EXCLUDED.playtime,
          is_auto_save = EXCLUDED.is_auto_save,
          version = EXCLUDED.version,
          save_data = EXCLUDED.save_data,
          metadata = EXCLUDED.metadata,
          updated_at = CURRENT_TIMESTAMP`,
        [
          saveId,
          userId,
          slotNumber,
          metadata.saveName,
          metadata.characterName,
          metadata.characterLevel,
          metadata.characterTribe,
          metadata.day,
          metadata.playtime,
          metadata.isAutoSave,
          metadata.version,
          JSON.stringify(compressedData),
          JSON.stringify(metadata)
        ]
      )

      await client.query('COMMIT')
      return metadata
    } catch (error) {
      await client.query('ROLLBACK')
      throw new Error(`Failed to save game: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      client.release()
    }
  }

  /**
   * Load game from a specific slot
   */
  async loadGame(userId: string, slotNumber: number): Promise<SaveData> {
    const client = await this.pool.connect()
    try {
      const result = await client.query(
        `SELECT save_data, version FROM game_saves 
         WHERE user_id = $1 AND slot_number = $2`,
        [userId, slotNumber]
      )

      if (result.rows.length === 0) {
        throw new Error(`Save slot ${slotNumber} not found`)
      }

      const compressedData = result.rows[0].save_data
      const version = result.rows[0].version

      // Decompress and validate
      const saveData = this.decompressSaveData(compressedData)
      this.validateSaveData(saveData, version)

      return saveData
    } catch (error) {
      throw new Error(`Failed to load game: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      client.release()
    }
  }

  /**
   * Get all save slots for a user
   */
  async getSaveSlots(userId: string, maxSlots: number = 10): Promise<SaveSlot[]> {
    const client = await this.pool.connect()
    try {
      const result = await client.query(
        `SELECT slot_number, metadata, updated_at 
         FROM game_saves 
         WHERE user_id = $1 
         ORDER BY slot_number`,
        [userId]
      )

      const saves = new Map<number, SaveMetadata>()
      result.rows.forEach(row => {
        saves.set(row.slot_number, row.metadata as SaveMetadata)
      })

      // Return all slots (filled and empty)
      const slots: SaveSlot[] = []
      for (let i = 1; i <= maxSlots; i++) {
        slots.push({
          slotNumber: i,
          metadata: saves.get(i) || null,
          isEmpty: !saves.has(i)
        })
      }

      return slots
    } finally {
      client.release()
    }
  }

  /**
   * Get save metadata for a specific slot
   */
  async getSaveMetadata(userId: string, slotNumber: number): Promise<SaveMetadata | null> {
    const client = await this.pool.connect()
    try {
      const result = await client.query(
        `SELECT metadata FROM game_saves 
         WHERE user_id = $1 AND slot_number = $2`,
        [userId, slotNumber]
      )

      if (result.rows.length === 0) {
        return null
      }

      return result.rows[0].metadata as SaveMetadata
    } finally {
      client.release()
    }
  }

  /**
   * Delete a save slot
   */
  async deleteSave(userId: string, slotNumber: number): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query(
        `DELETE FROM game_saves 
         WHERE user_id = $1 AND slot_number = $2`,
        [userId, slotNumber]
      )
    } finally {
      client.release()
    }
  }

  /**
   * Get auto-save for user (most recent)
   */
  async getAutoSave(userId: string): Promise<SaveData | null> {
    const client = await this.pool.connect()
    try {
      const result = await client.query(
        `SELECT save_data, version FROM game_saves 
         WHERE user_id = $1 AND is_auto_save = true 
         ORDER BY updated_at DESC 
         LIMIT 1`,
        [userId]
      )

      if (result.rows.length === 0) {
        return null
      }

      const compressedData = result.rows[0].save_data
      const version = result.rows[0].version

      const saveData = this.decompressSaveData(compressedData)
      this.validateSaveData(saveData, version)

      return saveData
    } finally {
      client.release()
    }
  }

  /**
   * Update playtime for a save
   */
  async updatePlaytime(userId: string, slotNumber: number, playtime: number): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query(
        `UPDATE game_saves 
         SET playtime = $3, updated_at = CURRENT_TIMESTAMP 
         WHERE user_id = $1 AND slot_number = $2`,
        [userId, slotNumber, playtime]
      )
    } finally {
      client.release()
    }
  }

  /**
   * Compress save data (remove redundant data, optimize structure)
   */
  private compressSaveData(saveData: SaveData): SaveData {
    // For now, just return as-is
    // In production, you could:
    // - Remove default values
    // - Compress large arrays
    // - Use binary encoding for numbers
    return saveData
  }

  /**
   * Decompress save data
   */
  private decompressSaveData(compressedData: any): SaveData {
    // For now, just return as-is
    return compressedData as SaveData
  }

  /**
   * Validate save data structure and version
   */
  private validateSaveData(saveData: SaveData, version: string): void {
    if (!saveData.player) {
      throw new Error('Invalid save: missing player data')
    }
    if (!saveData.tribe) {
      throw new Error('Invalid save: missing tribe data')
    }
    if (!saveData.npcs || !Array.isArray(saveData.npcs)) {
      throw new Error('Invalid save: missing or invalid NPC data')
    }
    if (typeof saveData.day !== 'number') {
      throw new Error('Invalid save: missing or invalid day')
    }

    // Version compatibility checks
    if (version !== '1.0.0') {
      // Future: Add migration logic for different versions
      console.warn(`Save version ${version} may require migration`)
    }
  }

  async close(): Promise<void> {
    await this.pool.end()
  }
}

