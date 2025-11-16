import { Pool, type PoolClient } from 'pg'
import type { NPC } from '../types.js'
import type { GameConfig } from './gameConfig.js'

export class DatabaseManager {
  private pool: Pool

  constructor() {
    // Get database connection from environment variables
    const connectionString = process.env.DATABASE_URL ||
      `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'three_tribes_chronicle'}`

    this.pool = new Pool({
      connectionString,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      // Connection pool settings
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err)
    })
  }

  async initialize(): Promise<void> {
    let retries = 10
    let delay = 2000

    while (retries > 0) {
      try {
        const client = await this.pool.connect()
        try {
          // Create tables if they don't exist
          await client.query(`
            CREATE TABLE IF NOT EXISTS npcs (
              id SERIAL PRIMARY KEY,
              npc_id VARCHAR(255) UNIQUE NOT NULL,
              data JSONB NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
          `)

          await client.query(`
            CREATE TABLE IF NOT EXISTS game_configs (
              id SERIAL PRIMARY KEY,
              config_key VARCHAR(255) UNIQUE NOT NULL,
              config_data JSONB NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
          `)

          // Create indexes for better performance
          await client.query(`
            CREATE INDEX IF NOT EXISTS idx_npc_id ON npcs(npc_id)
          `)

          await client.query(`
            CREATE INDEX IF NOT EXISTS idx_config_key ON game_configs(config_key)
          `)

          // Initialize save service tables
          const { SaveService } = await import('./saveService.js')
          const saveService = new SaveService()
          await saveService.initialize()

          console.log('✅ Database initialized successfully')
          return
        } finally {
          client.release()
        }
      } catch (error) {
        retries--
        if (retries === 0) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          console.error('\n❌ Error initializing database after retries:')
          console.error(`   ${errorMsg}\n`)
          console.error('💡 Troubleshooting tips:')
          console.error('   1. Make sure PostgreSQL is running')
          console.error('   2. Check your database connection settings:')
          console.error('      - DATABASE_URL or DB_* environment variables')
          console.error('      - Default: postgresql://postgres:postgres@localhost:5432/three_tribes_chronicle')
          console.error('   3. If using Docker: docker-compose up -d postgres')
          console.error('   4. Verify database exists: createdb three_tribes_chronicle')
          throw error
        }
        console.log(`⚠️ Database connection failed. Retrying in ${delay / 1000}s... (${retries} retries left)`)
        await new Promise(resolve => setTimeout(resolve, delay))
        delay *= 1.5 // Exponential backoff
      }
    }
  }

  async saveNPCs(npcs: NPC[]): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')

      // Delete all existing NPCs
      await client.query('DELETE FROM npcs')

      // Insert all NPCs
      for (const npc of npcs) {
        await client.query(
          'INSERT INTO npcs (npc_id, data, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (npc_id) DO UPDATE SET data = $2, updated_at = CURRENT_TIMESTAMP',
          [npc.id, JSON.stringify(npc)]
        )
      }

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw new Error(`Failed to save NPCs: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      client.release()
    }
  }

  async loadNPCs(): Promise<NPC[]> {
    const client = await this.pool.connect()
    try {
      const result = await client.query('SELECT data FROM npcs ORDER BY npc_id')
      return result.rows.map(row => row.data as NPC)
    } catch (error) {
      throw new Error(`Failed to load NPCs: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      client.release()
    }
  }

  async saveGameConfig(config: GameConfig, key: string = 'default'): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query(
        'INSERT INTO game_configs (config_key, config_data, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (config_key) DO UPDATE SET config_data = $2, updated_at = CURRENT_TIMESTAMP',
        [key, JSON.stringify(config)]
      )
    } catch (error) {
      throw new Error(`Failed to save game config: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      client.release()
    }
  }

  async loadGameConfig(key: string = 'default'): Promise<GameConfig | null> {
    const client = await this.pool.connect()
    try {
      const result = await client.query(
        'SELECT config_data FROM game_configs WHERE config_key = $1',
        [key]
      )

      if (result.rows.length === 0) {
        return null
      }

      return result.rows[0].config_data as GameConfig
    } catch (error) {
      throw new Error(`Failed to load game config: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      client.release()
    }
  }

  async close(): Promise<void> {
    await this.pool.end()
  }
}
