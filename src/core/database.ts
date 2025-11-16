import { Pool, type PoolClient } from 'pg'
import type { NPC } from '../types.js'
import type { GameConfig } from './gameConfig.js'

export class DatabaseManager {
  private pool: Pool

  constructor() {
    // Get database connection from environment variables
    const dbUser = process.env.DB_USER || 'postgres'
    const dbPassword = process.env.DB_PASSWORD || 'postgres'
    const dbHost = process.env.DB_HOST || '127.0.0.1'
    const dbPort = parseInt(process.env.DB_PORT || '5432')
    const dbName = process.env.DB_NAME || 'three_tribes_chronicle'

    // Log connection info (mask password)
    const maskedConnectionString = process.env.DATABASE_URL
      ? process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':***@')
      : `postgresql://${dbUser}:***@${dbHost}:${dbPort}/${dbName}`
    console.log(`🔌 Database connection: ${maskedConnectionString}`)

    // Use DATABASE_URL if provided, otherwise use individual parameters
    // Individual parameters help avoid IPv6 resolution issues
    if (process.env.DATABASE_URL) {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      })
    } else {
      this.pool = new Pool({
        host: dbHost,
        port: dbPort,
        user: dbUser,
        password: dbPassword,
        database: dbName,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      })
    }

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
        // First, test basic connection
        const client = await this.pool.connect()
        try {
          // Test connection with a simple query
          await client.query('SELECT NOW()')

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

          await client.query(`
            CREATE TABLE IF NOT EXISTS active_games (
              id SERIAL PRIMARY KEY,
              user_id VARCHAR(255) UNIQUE NOT NULL,
              game_data JSONB NOT NULL,
              playtime INTEGER NOT NULL DEFAULT 0,
              last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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

          await client.query(`
            CREATE INDEX IF NOT EXISTS idx_user_id_active ON active_games(user_id)
          `)

          await client.query(`
            CREATE INDEX IF NOT EXISTS idx_last_activity ON active_games(last_activity DESC)
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
        const errorMsg = error instanceof Error ? error.message : String(error)

        if (retries === 0) {
          console.error('\n❌ Error initializing database after retries:')
          console.error(`   ${errorMsg}\n`)

          // Provide specific error messages
          if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('connect')) {
            console.error('💡 Connection Refused - PostgreSQL is not running or not accessible')
            console.error('   Solutions:')
            console.error('   1. Start PostgreSQL:')
            console.error('      - macOS: brew services start postgresql@15')
            console.error('      - Linux: sudo systemctl start postgresql')
            console.error('      - Docker: docker-compose up -d postgres')
            console.error('   2. Check if PostgreSQL is running: pg_isready')
            console.error('   3. Verify host and port in connection string')
          } else if (errorMsg.includes('authentication') || errorMsg.includes('password')) {
            console.error('💡 Authentication Failed - Wrong username or password')
            console.error('   Solutions:')
            console.error('   1. Check DB_USER and DB_PASSWORD environment variables')
            console.error('   2. Verify DATABASE_URL connection string')
            console.error('   3. Test connection: psql -U postgres -h localhost')
          } else if (errorMsg.includes('does not exist') || errorMsg.includes('database')) {
            console.error('💡 Database Not Found - Database does not exist')
            console.error('   Solutions:')
            console.error('   1. Create database: createdb three_tribes_chronicle')
            console.error('   2. Or set DB_NAME environment variable')
            console.error('   3. Connect to PostgreSQL and run: CREATE DATABASE three_tribes_chronicle;')
          } else {
            console.error('💡 Troubleshooting tips:')
            console.error('   1. Make sure PostgreSQL is running')
            console.error('   2. Check your database connection settings:')
            console.error('      - DATABASE_URL or DB_* environment variables')
            console.error('      - Default: postgresql://postgres:postgres@localhost:5432/three_tribes_chronicle')
            console.error('   3. If using Docker: docker-compose up -d postgres')
            console.error('   4. Verify database exists: createdb three_tribes_chronicle')
          }
          throw error
        }
        console.log(`⚠️ Database connection failed. Retrying in ${delay / 1000}s... (${retries} retries left)`)
        console.log(`   Error: ${errorMsg}`)
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

  async tableExists(tableName: string): Promise<boolean> {
    const client = await this.pool.connect()
    try {
      const result = await client.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )`,
        [tableName]
      )
      return result.rows[0].exists
    } catch (error) {
      throw new Error(`Failed to check if table exists: ${error instanceof Error ? error.message : String(error)}`)
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

  /**
   * Save active game state for a user
   */
  async saveActiveGame(userId: string, gameData: any, playtime: number = 0): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query(
        `INSERT INTO active_games (user_id, game_data, playtime, last_activity, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id)
         DO UPDATE SET
           game_data = EXCLUDED.game_data,
           playtime = EXCLUDED.playtime,
           last_activity = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP`,
        [userId, JSON.stringify(gameData), playtime]
      )
    } catch (error) {
      throw new Error(`Failed to save active game: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      client.release()
    }
  }

  /**
   * Load active game state for a user
   */
  async loadActiveGame(userId: string): Promise<{ gameData: any; playtime: number } | null> {
    const client = await this.pool.connect()
    try {
      const result = await client.query(
        `SELECT game_data, playtime FROM active_games WHERE user_id = $1`,
        [userId]
      )

      if (result.rows.length === 0) {
        return null
      }

      return {
        gameData: result.rows[0].game_data,
        playtime: result.rows[0].playtime
      }
    } catch (error) {
      throw new Error(`Failed to load active game: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      client.release()
    }
  }

  /**
   * Delete active game for a user
   */
  async deleteActiveGame(userId: string): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query(
        `DELETE FROM active_games WHERE user_id = $1`,
        [userId]
      )
    } catch (error) {
      throw new Error(`Failed to delete active game: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      client.release()
    }
  }

  /**
   * Update playtime for active game
   */
  async updateActiveGamePlaytime(userId: string, playtime: number): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query(
        `UPDATE active_games 
         SET playtime = $2, last_activity = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1`,
        [userId, playtime]
      )
    } catch (error) {
      throw new Error(`Failed to update playtime: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      client.release()
    }
  }

  async close(): Promise<void> {
    await this.pool.end()
  }
}
