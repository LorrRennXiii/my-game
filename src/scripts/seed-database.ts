#!/usr/bin/env node
/**
 * Database Seeding Script
 * Seeds NPCs and Game Config data into PostgreSQL database
 */

import { DatabaseManager } from '../core/database.js'
import { GameConfigManager } from '../core/gameConfig.js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function seedDatabase() {
  console.log('🌱 Starting database seeding...\n')

  // Display connection info for debugging
  const dbUrl = process.env.DATABASE_URL
  const dbHost = process.env.DB_HOST || 'localhost'
  const dbPort = process.env.DB_PORT || '5432'
  const dbName = process.env.DB_NAME || 'three_tribes_chronicle'
  const dbUser = process.env.DB_USER || 'postgres'

  console.log('📋 Database Connection Info:')
  if (dbUrl) {
    // Mask password in connection string
    const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ':***@')
    console.log(`   Connection String: ${maskedUrl}`)
  } else {
    console.log(`   Host: ${dbHost}`)
    console.log(`   Port: ${dbPort}`)
    console.log(`   Database: ${dbName}`)
    console.log(`   User: ${dbUser}`)
  }
  console.log()

  const dbManager = new DatabaseManager()

  try {
    // Initialize database connection with retry logic
    console.log('📡 Connecting to database...')
    console.log('   (This may take a few seconds if the database is starting up)\n')

    await dbManager.initialize()
    console.log('✅ Database connection established\n')

    // Seed NPCs
    console.log('👥 Seeding NPCs...')
    const npcsPath = join(__dirname, '../data/npcs.json')
    const npcsData = readFileSync(npcsPath, 'utf-8')
    const npcs = JSON.parse(npcsData)

    if (!Array.isArray(npcs)) {
      throw new Error('NPCs data must be an array')
    }

    await dbManager.saveNPCs(npcs)
    console.log(`✅ Seeded ${npcs.length} NPCs:`)
    npcs.forEach(npc => {
      console.log(`   - ${npc.name} (${npc.role}) - ${npc.tribe}`)
    })
    console.log()

    // Seed Game Config
    console.log('⚙️  Seeding Game Config...')
    const configManager = new GameConfigManager()
    const defaultConfig = configManager.getDefaultConfig()

    await dbManager.saveGameConfig(defaultConfig, 'default')
    console.log('✅ Seeded default game configuration:')
    console.log(`   - Difficulty: ${defaultConfig.difficulty}`)
    console.log(`   - Encounter Chance: ${defaultConfig.encounterChance}%`)
    console.log(`   - XP Multiplier: ${defaultConfig.xpMultiplier}x`)
    console.log(`   - Base Stamina: ${defaultConfig.baseStamina}`)
    console.log(`   - Season Length: ${defaultConfig.seasonLength} days`)
    console.log()

    // Seed difficulty presets
    console.log('📊 Seeding difficulty presets...')

    // Easy preset
    const easyConfig = new GameConfigManager()
    easyConfig.setDifficulty('Easy')
    await dbManager.saveGameConfig(easyConfig.getConfig(), 'easy')
    console.log('   ✅ Easy preset saved')

    // Normal preset (already saved as default)
    console.log('   ✅ Normal preset saved (default)')

    // Hard preset
    const hardConfig = new GameConfigManager()
    hardConfig.setDifficulty('Hard')
    await dbManager.saveGameConfig(hardConfig.getConfig(), 'hard')
    console.log('   ✅ Hard preset saved')
    console.log()

    console.log('🎉 Database seeding completed successfully!')
    console.log('\n📋 Summary:')
    console.log(`   - NPCs: ${npcs.length}`)
    console.log(`   - Game Configs: 3 (default, easy, hard)`)
    console.log()

  } catch (error) {
    console.error('\n❌ Error seeding database:')
    if (error instanceof Error) {
      console.error(`   ${error.message}\n`)

      // Provide helpful error messages for common issues
      if (error.message.includes('ECONNREFUSED') || error.message.includes('connect')) {
        console.error('💡 Connection Refused - Possible solutions:')
        console.error('   1. Start PostgreSQL:')
        console.error('      - Local: brew services start postgresql (macOS)')
        console.error('      - Docker: docker-compose up -d postgres')
        console.error('   2. Check if PostgreSQL is running on the expected port')
        console.error('   3. Verify connection settings in environment variables\n')
      } else if (error.message.includes('authentication') || error.message.includes('password')) {
        console.error('💡 Authentication Failed - Check:')
        console.error('   1. Database username and password')
        console.error('   2. DB_USER and DB_PASSWORD environment variables')
        console.error('   3. DATABASE_URL connection string\n')
      } else if (error.message.includes('does not exist') || error.message.includes('database')) {
        console.error('💡 Database Not Found - Create it:')
        console.error('   createdb three_tribes_chronicle')
        console.error('   Or set DB_NAME environment variable\n')
      }
    } else {
      console.error(`   ${String(error)}\n`)
    }
    process.exit(1)
  } finally {
    try {
      await dbManager.close()
      console.log('🔌 Database connection closed')
    } catch (closeError) {
      // Ignore close errors
    }
  }
}

// Run the seeding script
seedDatabase().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

