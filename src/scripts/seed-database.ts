#!/usr/bin/env node
/**
 * Database Seeding Script
 * Seeds NPCs and Game Config data into PostgreSQL database
 * Only seeds if tables are empty or don't exist
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

  const dbManager = new DatabaseManager()

  try {
    // Initialize database connection (creates tables if they don't exist)
    console.log('📡 Connecting to database...')
    await dbManager.initialize()
    console.log('✅ Database connection established\n')

    // Check if NPCs table exists and has data - only seed if table doesn't exist or is empty
    console.log('👥 Checking NPCs table...')
    const npcsTableExists = await dbManager.tableExists('npcs')

    if (!npcsTableExists) {
      console.log('   NPCs table does not exist. It will be created during initialization.')
    }

    const existingNPCs = await dbManager.loadNPCs()
    if (existingNPCs && existingNPCs.length > 0) {
      console.log(`ℹ️  NPCs table already has ${existingNPCs.length} NPCs. Skipping NPC seeding.\n`)
    } else {
      // Seed NPCs from npcs.json
      console.log('   No NPCs found. Seeding from npcs.json...')
      const npcsPath = join(__dirname, '..', '..', 'src', 'data', 'npcs.json')
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
    }

    // Check if game config exists - only seed if missing
    console.log('⚙️  Checking game config...')
    const existingConfig = await dbManager.loadGameConfig('default')
    if (existingConfig) {
      console.log('ℹ️  Game config already exists. Skipping config seeding.\n')
    } else {
      // Seed Game Config
      console.log('   No config found. Seeding default game configuration...')
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
    }

    console.log('🎉 Database seeding completed successfully!')
    console.log()

  } catch (error) {
    console.error('\n❌ Error seeding database:')
    if (error instanceof Error) {
      console.error(`   ${error.message}\n`)
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

