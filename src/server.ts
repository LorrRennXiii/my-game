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
const npcs: NPC[] = loadJSON<NPC[]>('npcs.json')
const events: Event[] = loadJSON<Event[]>('events.json')

// API Routes

// Create new game session
app.post('/api/game/new', (req, res) => {
  try {
    const { name, tribe } = req.body
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const game = new GameLoop(undefined, undefined, npcs, events)
    if (name) game.setPlayerName(name)
    if (tribe) game.setPlayerTribe(tribe)
    
    game.startDay()
    gameSessions.set(sessionId, game)
    
    res.json({
      sessionId,
      player: game.getPlayer(),
      tribe: game.getTribe(),
      day: game.getDay(),
      stamina: game.getCurrentStamina(),
      maxStamina: game.getMaxStamina()
    })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create game' })
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
    
    res.json({
      player: game.getPlayer(),
      tribe: game.getTribe(),
      npcs: game.getNPCsByTribe(game.getPlayer().tribe),
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
    const { action, npcId } = req.body
    const game = gameSessions.get(sessionId)
    
    if (!game) {
      return res.status(404).json({ error: 'Game session not found' })
    }
    
    const result = game.executeAction(action, npcId)
    
    res.json({
      result,
      player: game.getPlayer(),
      tribe: game.getTribe(),
      stamina: game.getCurrentStamina(),
      maxStamina: game.getMaxStamina()
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
    const { filepath } = req.body
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const game = new GameLoop(undefined, undefined, npcs, events)
    await game.loadGame(filepath)
    game.startDay()
    
    gameSessions.set(sessionId, game)
    
    res.json({
      sessionId,
      player: game.getPlayer(),
      tribe: game.getTribe(),
      day: game.getDay(),
      stamina: game.getCurrentStamina(),
      maxStamina: game.getMaxStamina()
    })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to load game' })
  }
})

// List saves
app.get('/api/game/saves', async (req, res) => {
  try {
    const game = new GameLoop(undefined, undefined, npcs, events)
    const saves = await game.listSaves()
    res.json({ saves })
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list saves' })
  }
})

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`🌐 Three Tribes Chronicle server running on http://localhost:${PORT}`)
})

