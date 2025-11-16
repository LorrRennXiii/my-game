import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { GameLoop } from './gameLoop.js'
import { readFileSync } from 'fs'
import type { NPC, Event } from './types.js'
import { DatabaseManager } from './core/database.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, '..', 'public')))

// Helper function to load game state from database and create GameLoop instance
async function loadGameFromDatabase(userId: string): Promise<{ game: GameLoop; playtime: number } | null> {
  try {
    const activeGame = await dbManager.loadActiveGame(userId)
    if (!activeGame) {
      return null
    }

    const saveData = activeGame.gameData
    const gameNPCs = await getNPCsForGame()
    const gameConfig = await getGameConfigForGame()
    const game = new GameLoop(undefined, undefined, gameNPCs, events, undefined, gameConfig)
    await game.loadGameFromData(saveData)
    
    // Apply database config after loading (overrides saved game config)
    if (gameConfig) {
      game.updateGameConfig(gameConfig)
    }

    return { game, playtime: activeGame.playtime }
  } catch (error) {
    console.error('Error loading game from database:', error)
    return null
  }
}

// Helper function to save game state to database
async function saveGameToDatabase(userId: string, game: GameLoop, playtime: number = 0): Promise<void> {
  try {
    const saveData = game.getSaveData()
    await dbManager.saveActiveGame(userId, saveData, playtime)
  } catch (error) {
    console.error('Error saving game to database:', error)
    throw error
  }
}

function loadJSON<T>(filename: string): T {
  // Go up from dist/server.js to project root, then into src/data
  const filepath = path.join(__dirname, '..', 'src', 'data', filename)
  const content = readFileSync(filepath, 'utf-8')
  return JSON.parse(content) as T
}

// Initialize game data
let baseNPCs: NPC[] = loadJSON<NPC[]>('npcs.json')
const events: Event[] = loadJSON<Event[]>('events.json')

// Initialize database
const dbManager = new DatabaseManager()

// Initialize save service
import { SaveService } from './core/saveService.js'
const saveService = new SaveService()

// Load NPCs and config from database on startup (async, will be used when needed)
async function loadDatabaseData() {
  try {
    const npcs = await dbManager.loadNPCs()
    if (npcs && npcs.length > 0) {
      console.log(`✅ Loaded ${npcs.length} NPCs from database`)
      baseNPCs = npcs // Update baseNPCs with database NPCs
    } else {
      console.log('ℹ️ No NPCs in database, using base NPCs from file')
    }
  } catch (error) {
    console.warn('⚠️ Failed to load NPCs from database on startup:', error instanceof Error ? error.message : String(error))
  }
  
  try {
    const config = await dbManager.loadGameConfig('default')
    if (config) {
      console.log('✅ Loaded game config from database')
    } else {
      console.log('ℹ️ No game config in database, will use defaults')
    }
  } catch (error) {
    console.warn('⚠️ Failed to load game config from database on startup:', error instanceof Error ? error.message : String(error))
  }
}

// Initialize database on startup (with retry logic for Docker)
dbManager.initialize()
  .then(() => {
    // Load NPCs and config from database after initialization
    return loadDatabaseData()
  })
  .catch((error) => {
    console.error('⚠️ Failed to initialize database. Continuing without database storage:', error.message)
    console.log('💡 To enable database storage:')
    console.log('   - Set DATABASE_URL or DB_* environment variables')
    console.log('   - Default: postgresql://postgres:postgres@localhost:5432/three_tribes_chronicle')
    console.log('   - Run: npm run seed-db (to populate initial data)')
    console.log('   - The app will continue with file-based NPCs')
  })

// Initialize save service
saveService.initialize().catch((error) => {
  console.error('⚠️ Failed to initialize save service:', error.message)
  console.log('💡 Save service will fallback to file-based saves')
})

// Function to get NPCs from database (fallback to baseNPCs if database unavailable)
async function getNPCsForGame(): Promise<NPC[]> {
  try {
    const npcs = await dbManager.loadNPCs()
    if (npcs && npcs.length > 0) {
      return npcs
    }
  } catch (error) {
    console.warn('⚠️ Failed to load NPCs from database, using base NPCs:', error instanceof Error ? error.message : String(error))
  }
  return baseNPCs
}

// Function to get game config from database (fallback to default if database unavailable)
async function getGameConfigForGame(): Promise<any> {
  try {
    const config = await dbManager.loadGameConfig('default')
    if (config) {
      return config
    }
  } catch (error) {
    console.warn('⚠️ Failed to load game config from database, using default:', error instanceof Error ? error.message : String(error))
  }
  return undefined // Will use default config
}

// API Routes

// Create new game
app.post('/api/game/new', async (req, res) => {
  try {
    const { name, tribe, userId } = req.body
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }

    // Load NPCs and config from database
    const gameNPCs = await getNPCsForGame()
    const gameConfig = await getGameConfigForGame()
    const game = new GameLoop(undefined, undefined, gameNPCs, events, undefined, gameConfig)
    if (name) game.setPlayerName(name)
    if (tribe) game.setPlayerTribe(tribe)

    game.startDay()
    
    // Save to database
    await saveGameToDatabase(userId, game, 0)
    
    const player = game.getPlayer()
    res.json({
      userId,
      player,
      tribe: game.getTribe(),
      npcs: game.getNPCsByTribe(player.tribe),
      worldState: game.getWorldState(),
      day: game.getDay(),
      stamina: game.getCurrentStamina(),
      maxStamina: game.getMaxStamina(),
      health: game.getHealth(),
      maxHealth: game.getMaxHealth(),
      isResting: game.isResting(),
      restDaysRemaining: game.getRestDaysRemaining(),
      bag: game.getBag(),
      equipment: game.getEquipment()
    })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create game' })
  }
})

// List saves (must come before /api/game/:sessionId to avoid route conflict)
app.get('/api/game/saves', async (req, res) => {
  try {
    const game = new GameLoop(undefined, undefined, baseNPCs, events)
    const saves = await game.listSaves()
    res.json({ saves })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list saves' })
  }
})

// Get game state
app.get('/api/game/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const gameState = await loadGameFromDatabase(userId)
    
    if (!gameState) {
      return res.status(404).json({ error: 'Game not found' })
    }
    
    const { game } = gameState
    const player = game.getPlayer()
    res.json({
      player,
      tribe: game.getTribe(),
      npcs: game.getNPCsByTribe(player.tribe),
      worldState: game.getWorldState(),
      day: game.getDay(),
      stamina: game.getCurrentStamina(),
      maxStamina: game.getMaxStamina(),
      health: game.getHealth(),
      maxHealth: game.getMaxHealth(),
      bag: game.getBag(),
      equipment: game.getEquipment()
    })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get game state' })
  }
})

// Execute action
app.post('/api/game/:userId/action', async (req, res) => {
  try {
    const { userId } = req.params
    const { action, npcId, combatDecision } = req.body
    
    const gameState = await loadGameFromDatabase(userId)
    if (!gameState) {
      return res.status(404).json({ error: 'Game not found' })
    }
    
    const { game, playtime } = gameState
    const result = game.executeAction(action, npcId, combatDecision)
    
    // Auto-save after action
    await saveGameToDatabase(userId, game, playtime)
    
    res.json({
      result,
      player: game.getPlayer(),
      tribe: game.getTribe(),
      worldState: game.getWorldState(),
      stamina: game.getCurrentStamina(),
      maxStamina: game.getMaxStamina(),
      health: game.getHealth(),
      maxHealth: game.getMaxHealth(),
      isResting: game.isResting(),
      restDaysRemaining: game.getRestDaysRemaining(),
      bag: game.getBag(),
      equipment: game.getEquipment()
    })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to execute action' })
  }
})

// End day
app.post('/api/game/:userId/end-day', async (req, res) => {
  try {
    const { userId } = req.params
    
    const gameState = await loadGameFromDatabase(userId)
    if (!gameState) {
      return res.status(404).json({ error: 'Game not found' })
    }
    
    const { game, playtime } = gameState
    const growthMessages = game.endDay()
    
    // Auto-save after end day
    await saveGameToDatabase(userId, game, playtime)
    
    res.json({
      growthMessages,
      player: game.getPlayer(),
      tribe: game.getTribe(),
      worldState: game.getWorldState(),
      day: game.getDay(),
      stamina: game.getCurrentStamina(),
      maxStamina: game.getMaxStamina(),
      health: game.getHealth(),
      maxHealth: game.getMaxHealth(),
      isResting: game.isResting(),
      restDaysRemaining: game.getRestDaysRemaining(),
      bag: game.getBag(),
      equipment: game.getEquipment()
    })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to end day' })
  }
})

// Equip item
app.post('/api/game/:userId/equip', async (req, res) => {
  try {
    const { userId } = req.params
    const { itemId, slot } = req.body
    
    const gameState = await loadGameFromDatabase(userId)
    if (!gameState) {
      return res.status(404).json({ error: 'Game not found' })
    }
    
    const { game, playtime } = gameState
    const result = game.equipItem(itemId, slot)
    
    // Auto-save after equip
    await saveGameToDatabase(userId, game, playtime)
    
    res.json({
      result,
      player: game.getPlayer(),
      bag: game.getBag(),
      equipment: game.getEquipment()
    })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to equip item' })
  }
})

// Unequip item
app.post('/api/game/:userId/unequip', async (req, res) => {
  try {
    const { userId } = req.params
    const { slot } = req.body
    
    const gameState = await loadGameFromDatabase(userId)
    if (!gameState) {
      return res.status(404).json({ error: 'Game not found' })
    }
    
    const { game, playtime } = gameState
    const result = game.unequipItem(slot)
    
    // Auto-save after unequip
    await saveGameToDatabase(userId, game, playtime)
    
    res.json({
      result,
      player: game.getPlayer(),
      bag: game.getBag(),
      equipment: game.getEquipment()
    })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to unequip item' })
  }
})

// Consume item
app.post('/api/game/:userId/consume', async (req, res) => {
  try {
    const { userId } = req.params
    const { itemId } = req.body
    
    const gameState = await loadGameFromDatabase(userId)
    if (!gameState) {
      return res.status(404).json({ error: 'Game not found' })
    }
    
    const { game, playtime } = gameState
    const result = game.consumeItem(itemId)
    
    // Auto-save after consume
    await saveGameToDatabase(userId, game, playtime)
    
    res.json({
      result,
      player: game.getPlayer(),
      bag: game.getBag(),
      health: game.getHealth(),
      maxHealth: game.getMaxHealth(),
      stamina: game.getCurrentStamina(),
      maxStamina: game.getMaxStamina()
    })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to consume item' })
  }
})

// Save game (legacy file-based - kept for backward compatibility)
app.post('/api/game/:userId/save', async (req, res) => {
  try {
    const { userId } = req.params
    
    const gameState = await loadGameFromDatabase(userId)
    if (!gameState) {
      return res.status(404).json({ error: 'Game not found' })
    }
    
    const filepath = await gameState.game.saveGame()
    
    res.json({ success: true, filepath })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to save game' })
  }
})

// New Save System API Endpoints

// Get all save slots for a user
app.get('/api/saves/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const slots = await saveService.getSaveSlots(userId)
    res.json({ slots })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get save slots' })
  }
})

// Save game to a specific slot
app.post('/api/saves/:userId/slot/:slotNumber', async (req, res) => {
  try {
    const { userId, slotNumber } = req.params
    const { saveName, isAutoSave } = req.body
    
    const gameState = await loadGameFromDatabase(userId)
    if (!gameState) {
      return res.status(404).json({ error: 'Game not found' })
    }

    const { game, playtime } = gameState

    // Get save data from game
    const saveData = game.getSaveData()

    const metadata = await saveService.saveGame(
      userId,
      parseInt(slotNumber),
      saveData,
      saveName,
      isAutoSave === true,
      playtime
    )

    res.json({ success: true, metadata })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to save game' })
  }
})

// Load game from a specific slot
app.post('/api/saves/:userId/slot/:slotNumber/load', async (req, res) => {
  try {
    const { userId, slotNumber } = req.params

    const saveData = await saveService.loadGame(userId, parseInt(slotNumber))
    const metadata = await saveService.getSaveMetadata(userId, parseInt(slotNumber))

    // Load NPCs and config from database
    const gameNPCs = await getNPCsForGame()
    const gameConfig = await getGameConfigForGame()
    const game = new GameLoop(undefined, undefined, gameNPCs, events, undefined, gameConfig)
    
    await game.loadGameFromData(saveData)
    
    // Apply database config after loading (overrides saved game config)
    if (gameConfig) {
      game.updateGameConfig(gameConfig)
    }
    
    game.startDay()
    
    // Save to active games table
    const playtime = metadata?.playtime || 0
    await saveGameToDatabase(userId, game, playtime)

    const player = game.getPlayer()
    res.json({
      userId,
      player,
      tribe: game.getTribe(),
      npcs: game.getNPCsByTribe(player.tribe),
      worldState: game.getWorldState(),
      day: game.getDay(),
      stamina: game.getCurrentStamina(),
      maxStamina: game.getMaxStamina(),
      health: game.getHealth(),
      maxHealth: game.getMaxHealth(),
      isResting: game.isResting(),
      restDaysRemaining: game.getRestDaysRemaining(),
      metadata
    })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load game' })
  }
})

// Delete a save slot
app.delete('/api/saves/:userId/slot/:slotNumber', async (req, res) => {
  try {
    const { userId, slotNumber } = req.params
    await saveService.deleteSave(userId, parseInt(slotNumber))
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete save' })
  }
})

// Get auto-save
app.get('/api/saves/:userId/autosave', async (req, res) => {
  try {
    const { userId } = req.params
    const saveData = await saveService.getAutoSave(userId)
    
    if (!saveData) {
      return res.status(404).json({ error: 'No auto-save found' })
    }

    res.json({ saveData })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get auto-save' })
  }
})

// Update playtime
app.post('/api/saves/:userId/playtime', async (req, res) => {
  try {
    const { userId } = req.params
    const { slotNumber, playtime } = req.body

    if (slotNumber && playtime !== undefined) {
      await saveService.updatePlaytime(userId, slotNumber, playtime)
    }

    // Also update active game playtime
    if (playtime !== undefined) {
      await dbManager.updateActiveGamePlaytime(userId, playtime)
    }

    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update playtime' })
  }
})

// Load game (legacy file-based - kept for backward compatibility)
app.post('/api/game/load', async (req, res) => {
  try {
    const { filepath, userId } = req.body
    
    if (!filepath) {
      return res.status(400).json({ error: 'Filepath is required' })
    }
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' })
    }
    
    // Load NPCs and config from database
    const gameNPCs = await getNPCsForGame()
    const gameConfig = await getGameConfigForGame()
    const game = new GameLoop(undefined, undefined, gameNPCs, events, undefined, gameConfig)
    await game.loadGame(filepath)
    
    // Apply database config after loading (overrides saved game config)
    if (gameConfig) {
      game.updateGameConfig(gameConfig)
    }
    
    game.startDay()
    
    // Save to active games table
    await saveGameToDatabase(userId, game, 0)
    
    const player = game.getPlayer()
    res.json({
      userId,
      player,
      tribe: game.getTribe(),
      npcs: game.getNPCsByTribe(player.tribe),
      worldState: game.getWorldState(),
      day: game.getDay(),
      stamina: game.getCurrentStamina(),
      maxStamina: game.getMaxStamina(),
      health: game.getHealth(),
      maxHealth: game.getMaxHealth()
    })
  } catch (error) {
    console.error('Load game error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to load game'
    res.status(500).json({ error: errorMessage })
  }
})

// NPC Management API

// Get all NPCs (base data)
app.get('/api/npcs', async (req, res) => {
  try {
    const npcs = await getNPCsForGame()
    res.json({ npcs })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get NPCs' })
  }
})

// Get NPCs from a game
app.get('/api/npcs/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const gameState = await loadGameFromDatabase(userId)
    
    if (!gameState) {
      return res.status(404).json({ error: 'Game not found' })
    }
    
    res.json({ npcs: gameState.game.getNPCs() })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get NPCs' })
  }
})

// Update NPC in a game
app.put('/api/npcs/:userId/:npcId', async (req, res) => {
  try {
    const { userId, npcId } = req.params
    const updates = req.body
    
    const gameState = await loadGameFromDatabase(userId)
    if (!gameState) {
      return res.status(404).json({ error: 'Game not found' })
    }
    
    const { game, playtime } = gameState
    const npc = game.getNPC(npcId)
    if (!npc) {
      return res.status(404).json({ error: 'NPC not found' })
    }
    
    // Update NPC properties
    if (updates.name !== undefined) npc.name = updates.name
    if (updates.role !== undefined) npc.role = updates.role
    if (updates.disposition !== undefined) npc.disposition = updates.disposition
    // Relationships are stored in player.relationships, not on NPC
    // This update is ignored for now
    if (updates.growth_path !== undefined) npc.growth_path = updates.growth_path
    if (updates.level !== undefined) npc.level = Math.max(1, updates.level)
    if (updates.xp !== undefined) npc.xp = Math.max(0, updates.xp)
    if (updates.stats) {
      if (!npc.stats) npc.stats = { str: 3, dex: 3, wis: 3, cha: 3 }
      if (updates.stats.str !== undefined) npc.stats.str = Math.max(1, updates.stats.str)
      if (updates.stats.dex !== undefined) npc.stats.dex = Math.max(1, updates.stats.dex)
      if (updates.stats.wis !== undefined) npc.stats.wis = Math.max(1, updates.stats.wis)
      if (updates.stats.cha !== undefined) npc.stats.cha = Math.max(1, updates.stats.cha)
      if (updates.stats.luck !== undefined && npc.stats.luck !== undefined) {
        npc.stats.luck = Math.max(1, updates.stats.luck)
      }
    }
    if (updates.flags) {
      if (!npc.flags) npc.flags = {};
      Object.assign(npc.flags, updates.flags)
    }
    
    // Auto-save after NPC update
    await saveGameToDatabase(userId, game, playtime)
    
    res.json({ success: true, npc })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update NPC' })
  }
})

// Manually trigger NPC growth
app.post('/api/npcs/:userId/:npcId/grow', async (req, res) => {
  try {
    const { userId, npcId } = req.params
    const { xpAmount } = req.body
    
    const gameState = await loadGameFromDatabase(userId)
    if (!gameState) {
      return res.status(404).json({ error: 'Game not found' })
    }
    
    const { game, playtime } = gameState
    const leveledUp = game.triggerNPCGrowth(npcId, xpAmount || 5)
    const npc = game.getNPC(npcId)
    
    // Auto-save after NPC growth
    await saveGameToDatabase(userId, game, playtime)
    
    res.json({ success: true, leveledUp, npc })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to grow NPC' })
  }
})

// Game Master API

// Get game config
app.get('/api/game/:userId/config', async (req, res) => {
  try {
    const { userId } = req.params
    const gameState = await loadGameFromDatabase(userId)
    
    if (!gameState) {
      return res.status(404).json({ error: 'Game not found' })
    }
    
    res.json({ config: gameState.game.getGameConfig() })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get config' })
  }
})

// Update game config
app.put('/api/game/:userId/config', async (req, res) => {
  try {
    const { userId } = req.params
    const updates = req.body
    
    const gameState = await loadGameFromDatabase(userId)
    if (!gameState) {
      return res.status(404).json({ error: 'Game not found' })
    }
    
    const { game, playtime } = gameState
    game.updateGameConfig(updates)
    
    // Auto-save after config update
    await saveGameToDatabase(userId, game, playtime)
    
    res.json({ success: true, config: game.getGameConfig() })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update config' })
  }
})

// Set difficulty preset
app.post('/api/game/:userId/config/difficulty', async (req, res) => {
  try {
    const { userId } = req.params
    const { difficulty } = req.body
    
    const gameState = await loadGameFromDatabase(userId)
    if (!gameState) {
      return res.status(404).json({ error: 'Game not found' })
    }
    
    if (!['Easy', 'Normal', 'Hard'].includes(difficulty)) {
      return res.status(400).json({ error: 'Invalid difficulty. Must be Easy, Normal, or Hard' })
    }
    
    const { game, playtime } = gameState
    game.setDifficulty(difficulty)
    
    // Auto-save after difficulty change
    await saveGameToDatabase(userId, game, playtime)
    
    res.json({ success: true, config: game.getGameConfig() })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to set difficulty' })
  }
})

// Serve map page
app.get('/map.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'map.html'))
})

// Database API endpoints for NPCs and Game Config

// Save permanent NPCs
app.post('/api/database/npcs', async (req, res) => {
  try {
    const { npcs } = req.body
    if (!npcs || !Array.isArray(npcs)) {
      return res.status(400).json({ error: 'NPCs array is required' })
    }
    await dbManager.saveNPCs(npcs)
    res.json({ success: true, message: `Saved ${npcs.length} NPCs to database` })
  } catch (error) {
    console.error('Error saving NPCs:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to save NPCs' })
  }
})

// Load permanent NPCs
app.get('/api/database/npcs', async (req, res) => {
  try {
    const npcs = await dbManager.loadNPCs()
    res.json({ npcs })
  } catch (error) {
    console.error('Error loading NPCs:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load NPCs' })
  }
})

// Save game config
app.post('/api/database/config', async (req, res) => {
  try {
    const { config, key } = req.body
    if (!config) {
      return res.status(400).json({ error: 'Config object is required' })
    }
    await dbManager.saveGameConfig(config, key || 'default')
    res.json({ success: true, message: 'Game config saved to database' })
  } catch (error) {
    console.error('Error saving config:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to save config' })
  }
})

// Load game config
app.get('/api/database/config', async (req, res) => {
  try {
    const key = req.query.key as string || 'default'
    const config = await dbManager.loadGameConfig(key)
    if (!config) {
      return res.status(404).json({ error: 'Config not found' })
    }
    res.json({ config })
  } catch (error) {
    console.error('Error loading config:', error)
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load config' })
  }
})

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`🌐 Three Tribes Chronicle server running on http://localhost:${PORT}`)
})

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...')
  await dbManager.close()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...')
  await dbManager.close()
  process.exit(0)
})

