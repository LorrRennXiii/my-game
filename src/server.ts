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

// In-memory game sessions (in production, use Redis or database)
const gameSessions = new Map<string, GameLoop>()

// Track playtime for each session
const sessionPlaytime = new Map<string, { startTime: number; totalPlaytime: number }>()

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

// Initialize database on startup (with retry logic for Docker)
dbManager.initialize().catch((error) => {
  console.error('⚠️ Failed to initialize database. Continuing without database storage:', error.message)
  console.log('💡 To enable database storage:')
  console.log('   - Set DATABASE_URL or DB_* environment variables')
  console.log('   - Or use Docker Compose: docker-compose up')
  console.log('   - The app will continue with localStorage fallback')
})

// Initialize save service
saveService.initialize().catch((error) => {
  console.error('⚠️ Failed to initialize save service:', error.message)
  console.log('💡 Save service will fallback to file-based saves')
})

// Function to get NPCs (with permanent overrides from request)
function getNPCsForGame(permanentNPCs?: NPC[]): NPC[] {
  if (permanentNPCs && permanentNPCs.length > 0) {
    return permanentNPCs
  }
  return baseNPCs
}

// API Routes

// Create new game session
app.post('/api/game/new', (req, res) => {
  try {
    const { name, tribe } = req.body
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Load permanent config and NPCs from request (sent by frontend)
    const permanentConfig = req.body.permanentConfig || undefined
    const permanentNPCs = req.body.permanentNPCs || undefined
    const gameNPCs = getNPCsForGame(permanentNPCs)
    const game = new GameLoop(undefined, undefined, gameNPCs, events, undefined, permanentConfig)
    if (name) game.setPlayerName(name)
    if (tribe) game.setPlayerTribe(tribe)

    game.startDay()
    gameSessions.set(sessionId, game)
    
    const player = game.getPlayer()
    res.json({
      sessionId,
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
app.get('/api/game/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params
    const game = gameSessions.get(sessionId)
    
    if (!game) {
      return res.status(404).json({ error: 'Game session not found' })
    }
    
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
app.post('/api/game/:sessionId/action', (req, res) => {
  try {
    const { sessionId } = req.params
    const { action, npcId, combatDecision } = req.body
    const game = gameSessions.get(sessionId)
    
    if (!game) {
      return res.status(404).json({ error: 'Game session not found' })
    }
    
    const result = game.executeAction(action, npcId, combatDecision)
    
    // Update playtime tracking
    const playtimeData = sessionPlaytime.get(sessionId)
    if (playtimeData) {
      const currentSessionTime = Math.floor((Date.now() - playtimeData.startTime) / 1000)
      playtimeData.totalPlaytime += currentSessionTime
      playtimeData.startTime = Date.now()
    } else {
      sessionPlaytime.set(sessionId, { startTime: Date.now(), totalPlaytime: 0 })
    }
    
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
app.post('/api/game/:sessionId/end-day', (req, res) => {
  try {
    const { sessionId } = req.params
    const game = gameSessions.get(sessionId)
    
    if (!game) {
      return res.status(404).json({ error: 'Game session not found' })
    }
    
    const growthMessages = game.endDay()
    
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
app.post('/api/game/:sessionId/equip', (req, res) => {
  try {
    const { sessionId } = req.params
    const { itemId, slot } = req.body
    const game = gameSessions.get(sessionId)
    
    if (!game) {
      return res.status(404).json({ error: 'Game session not found' })
    }
    
    const result = game.equipItem(itemId, slot)
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
app.post('/api/game/:sessionId/unequip', (req, res) => {
  try {
    const { sessionId } = req.params
    const { slot } = req.body
    const game = gameSessions.get(sessionId)
    
    if (!game) {
      return res.status(404).json({ error: 'Game session not found' })
    }
    
    const result = game.unequipItem(slot)
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
app.post('/api/game/:sessionId/consume', (req, res) => {
  try {
    const { sessionId } = req.params
    const { itemId } = req.body
    const game = gameSessions.get(sessionId)
    
    if (!game) {
      return res.status(404).json({ error: 'Game session not found' })
    }
    
    const result = game.consumeItem(itemId)
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
app.post('/api/game/:sessionId/save', async (req, res) => {
  try {
    const { sessionId } = req.params
    const game = gameSessions.get(sessionId)
    
    if (!game) {
      return res.status(404).json({ error: 'Game session not found' })
    }
    
    const filepath = await game.saveGame()
    
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
    
    const game = gameSessions.get(userId)
    if (!game) {
      return res.status(404).json({ error: 'Game session not found' })
    }

    // Calculate playtime
    const playtimeData = sessionPlaytime.get(userId) || { startTime: Date.now(), totalPlaytime: 0 }
    const currentSessionTime = Math.floor((Date.now() - playtimeData.startTime) / 1000)
    const totalPlaytime = playtimeData.totalPlaytime + currentSessionTime

    // Get save data from game
    const saveData = game.getSaveData()

    const metadata = await saveService.saveGame(
      userId,
      parseInt(slotNumber),
      saveData,
      saveName,
      isAutoSave === true,
      totalPlaytime
    )

    // Reset session playtime after save
    sessionPlaytime.set(userId, { startTime: Date.now(), totalPlaytime })

    res.json({ success: true, metadata })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to save game' })
  }
})

// Load game from a specific slot
app.post('/api/saves/:userId/slot/:slotNumber/load', async (req, res) => {
  try {
    const { userId, slotNumber } = req.params
    const { permanentConfig, permanentNPCs } = req.body

    const saveData = await saveService.loadGame(userId, parseInt(slotNumber))
    const metadata = await saveService.getSaveMetadata(userId, parseInt(slotNumber))

    // Create new session
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const gameNPCs = getNPCsForGame(permanentNPCs)
    const game = new GameLoop(undefined, undefined, gameNPCs, events, undefined, permanentConfig)
    
    await game.loadGameFromData(saveData)
    
    // Apply permanent config after loading
    if (permanentConfig) {
      game.updateGameConfig(permanentConfig)
    }
    
    game.startDay()
    gameSessions.set(sessionId, game)

    // Restore playtime tracking
    if (metadata) {
      sessionPlaytime.set(sessionId, { 
        startTime: Date.now(), 
        totalPlaytime: metadata.playtime 
      })
    } else {
      sessionPlaytime.set(sessionId, { startTime: Date.now(), totalPlaytime: 0 })
    }

    const player = game.getPlayer()
    res.json({
      sessionId,
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

    // Also update in-memory tracking
    const playtimeData = sessionPlaytime.get(userId)
    if (playtimeData) {
      const currentSessionTime = Math.floor((Date.now() - playtimeData.startTime) / 1000)
      playtimeData.totalPlaytime += currentSessionTime
      playtimeData.startTime = Date.now()
    }

    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update playtime' })
  }
})

// Load game
app.post('/api/game/load', async (req, res) => {
  try {
    const { filepath, permanentConfig, permanentNPCs } = req.body
    
    if (!filepath) {
      return res.status(400).json({ error: 'Filepath is required' })
    }
    
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Load permanent config and NPCs if provided (overrides saved config)
    const gameNPCs = getNPCsForGame(permanentNPCs)
    const game = new GameLoop(undefined, undefined, gameNPCs, events, undefined, permanentConfig)
    await game.loadGame(filepath)
    
    // Apply permanent config after loading (overrides saved game config)
    if (permanentConfig) {
      game.updateGameConfig(permanentConfig)
    }
    
    game.startDay()
    
    gameSessions.set(sessionId, game)
    
    const player = game.getPlayer()
    res.json({
      sessionId,
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
app.get('/api/npcs', (req, res) => {
  try {
    res.json({ npcs: baseNPCs })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get NPCs' })
  }
})

// Get NPCs from a game session
app.get('/api/npcs/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params
    const game = gameSessions.get(sessionId)
    
    if (!game) {
      return res.status(404).json({ error: 'Game session not found' })
    }
    
    res.json({ npcs: game.getNPCs() })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get NPCs' })
  }
})

// Update NPC in a game session
app.put('/api/npcs/:sessionId/:npcId', (req, res) => {
  try {
    const { sessionId, npcId } = req.params
    const updates = req.body
    const game = gameSessions.get(sessionId)
    
    if (!game) {
      return res.status(404).json({ error: 'Game session not found' })
    }
    
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
    
    res.json({ success: true, npc })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update NPC' })
  }
})

// Manually trigger NPC growth
app.post('/api/npcs/:sessionId/:npcId/grow', (req, res) => {
  try {
    const { sessionId, npcId } = req.params
    const { xpAmount } = req.body
    const game = gameSessions.get(sessionId)
    
    if (!game) {
      return res.status(404).json({ error: 'Game session not found' })
    }
    
    const leveledUp = game.triggerNPCGrowth(npcId, xpAmount || 5)
    const npc = game.getNPC(npcId)
    
    res.json({ success: true, leveledUp, npc })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to grow NPC' })
  }
})

// Game Master API

// Get game config
app.get('/api/game/:sessionId/config', (req, res) => {
  try {
    const { sessionId } = req.params
    const game = gameSessions.get(sessionId)
    
    if (!game) {
      return res.status(404).json({ error: 'Game session not found' })
    }
    
    res.json({ config: game.getGameConfig() })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get config' })
  }
})

// Update game config
app.put('/api/game/:sessionId/config', (req, res) => {
  try {
    const { sessionId } = req.params
    const updates = req.body
    const game = gameSessions.get(sessionId)
    
    if (!game) {
      return res.status(404).json({ error: 'Game session not found' })
    }
    
    game.updateGameConfig(updates)
    
    res.json({ success: true, config: game.getGameConfig() })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update config' })
  }
})

// Set difficulty preset
app.post('/api/game/:sessionId/config/difficulty', (req, res) => {
  try {
    const { sessionId } = req.params
    const { difficulty } = req.body
    const game = gameSessions.get(sessionId)
    
    if (!game) {
      return res.status(404).json({ error: 'Game session not found' })
    }
    
    if (!['Easy', 'Normal', 'Hard'].includes(difficulty)) {
      return res.status(400).json({ error: 'Invalid difficulty. Must be Easy, Normal, or Hard' })
    }
    
    game.setDifficulty(difficulty)
    
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

