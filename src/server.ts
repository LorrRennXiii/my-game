import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { GameLoop } from './gameLoop.js'
import { readFileSync } from 'fs'
import type { NPC, Event } from './types.js'

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

function loadJSON<T>(filename: string): T {
  // Go up from dist/server.js to project root, then into src/data
  const filepath = path.join(__dirname, '..', 'src', 'data', filename)
  const content = readFileSync(filepath, 'utf-8')
  return JSON.parse(content) as T
}

// Initialize game data
let baseNPCs: NPC[] = loadJSON<NPC[]>('npcs.json')
const events: Event[] = loadJSON<Event[]>('events.json')

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
      maxHealth: game.getMaxHealth()
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
      maxStamina: game.getMaxStamina()
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
    
    res.json({
      result,
      player: game.getPlayer(),
      tribe: game.getTribe(),
      worldState: game.getWorldState(),
      stamina: game.getCurrentStamina(),
      maxStamina: game.getMaxStamina(),
      health: game.getHealth(),
      maxHealth: game.getMaxHealth()
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
      maxStamina: game.getMaxStamina()
    })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to end day' })
  }
})

// Save game
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
    if (updates.relationship !== undefined) npc.relationship = Math.max(0, Math.min(100, updates.relationship))
    if (updates.growth_path !== undefined) npc.growth_path = updates.growth_path
    if (updates.level !== undefined) npc.level = Math.max(1, updates.level)
    if (updates.xp !== undefined) npc.xp = Math.max(0, updates.xp)
    if (updates.stats) {
      if (!npc.stats) npc.stats = { str: 3, dex: 3, wis: 3, cha: 3, luck: 3 }
      if (updates.stats.str !== undefined) npc.stats.str = Math.max(1, updates.stats.str)
      if (updates.stats.dex !== undefined) npc.stats.dex = Math.max(1, updates.stats.dex)
      if (updates.stats.wis !== undefined) npc.stats.wis = Math.max(1, updates.stats.wis)
      if (updates.stats.cha !== undefined) npc.stats.cha = Math.max(1, updates.stats.cha)
      if (updates.stats.luck !== undefined) npc.stats.luck = Math.max(1, updates.stats.luck)
    }
    if (updates.flags) {
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

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`🌐 Three Tribes Chronicle server running on http://localhost:${PORT}`)
})

