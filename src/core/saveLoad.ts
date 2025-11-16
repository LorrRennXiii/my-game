import { promises as fs } from 'fs'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
import type { Player, Tribe, NPC } from '../types.js'
import type { WorldState } from './world.js'
import type { GameConfig } from './gameConfig.js'

export interface SaveData {
  player: Player
  tribe: Tribe
  npcs: NPC[]
  day: number
  timestamp: number
  worldState?: WorldState
  lastNPCEncounters?: Record<string, { day: number; level: number }>
  gameConfig?: Partial<GameConfig>
}

export class SaveManager {
  private saveDir: string

  constructor(saveDir?: string) {
    if (saveDir) {
      this.saveDir = saveDir
    } else {
      // Get project root (go up from dist/core to project root)
      const __filename = fileURLToPath(import.meta.url)
      const __dirname = dirname(__filename)
      // From dist/core/saveLoad.js -> dist/core -> dist -> project root
      this.saveDir = path.join(__dirname, '..', '..', 'saves')
    }
  }

  async ensureSaveDir(): Promise<void> {
    try {
      await fs.mkdir(this.saveDir, { recursive: true })
    } catch (error) {
      // If it's not a "directory already exists" error, rethrow
      if (error instanceof Error && (error as any).code !== 'EEXIST') {
        throw new Error(`Failed to create save directory: ${error.message}`)
      }
    }
  }

  async saveGame(
    player: Player, 
    tribe: Tribe, 
    npcs: NPC[], 
    day: number, 
    worldState?: WorldState,
    lastNPCEncounters?: Record<string, { day: number; level: number }>,
    gameConfig?: Partial<GameConfig>
  ): Promise<string> {
    try {
      await this.ensureSaveDir()

      const saveData: SaveData = {
        player,
        tribe,
        npcs,
        day,
        timestamp: Date.now(),
        worldState,
        lastNPCEncounters,
        gameConfig
      }

      // Validate that we can stringify the data
      let jsonString: string
      try {
        jsonString = JSON.stringify(saveData, null, 2)
      } catch (stringifyError) {
        throw new Error(`Failed to serialize save data: ${stringifyError instanceof Error ? stringifyError.message : String(stringifyError)}`)
      }

      const filename = `save_${Date.now()}.json`
      const filepath = path.join(this.saveDir, filename)

      await fs.writeFile(filepath, jsonString, 'utf-8')

      return filepath
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : ''
      throw new Error(`Failed to save game: ${errorMessage}${errorStack ? `\n${errorStack}` : ''}`)
    }
  }

  async loadGame(filepath: string): Promise<SaveData> {
    try {
      const data = await fs.readFile(filepath, 'utf-8')
      return JSON.parse(data) as SaveData
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to read save file: ${errorMessage}`)
    }
  }

  async listSaves(): Promise<string[]> {
    await this.ensureSaveDir()

    try {
      const files = await fs.readdir(this.saveDir)
      return files
        .filter(file => file.startsWith('save_') && file.endsWith('.json'))
        .map(file => path.join(this.saveDir, file))
        .sort()
        .reverse() // Most recent first
    } catch (error) {
      return []
    }
  }

  async deleteSave(filepath: string): Promise<void> {
    try {
      await fs.unlink(filepath)
    } catch (error) {
      // File might not exist
    }
  }
}

