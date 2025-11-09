import { promises as fs } from 'fs';
import path from 'path';
import type { Player, Tribe, NPC } from '../types.js';

export interface SaveData {
  player: Player;
  tribe: Tribe;
  npcs: NPC[];
  day: number;
  timestamp: number;
}

export class SaveManager {
  private saveDir: string;

  constructor(saveDir: string = './saves') {
    this.saveDir = saveDir;
  }

  async ensureSaveDir(): Promise<void> {
    try {
      await fs.mkdir(this.saveDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  async saveGame(player: Player, tribe: Tribe, npcs: NPC[], day: number): Promise<string> {
    await this.ensureSaveDir();

    const saveData: SaveData = {
      player,
      tribe,
      npcs,
      day,
      timestamp: Date.now()
    };

    const filename = `save_${Date.now()}.json`;
    const filepath = path.join(this.saveDir, filename);

    await fs.writeFile(filepath, JSON.stringify(saveData, null, 2), 'utf-8');

    return filepath;
  }

  async loadGame(filepath: string): Promise<SaveData> {
    const data = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(data) as SaveData;
  }

  async listSaves(): Promise<string[]> {
    await this.ensureSaveDir();
    
    try {
      const files = await fs.readdir(this.saveDir);
      return files
        .filter(file => file.startsWith('save_') && file.endsWith('.json'))
        .map(file => path.join(this.saveDir, file))
        .sort()
        .reverse(); // Most recent first
    } catch (error) {
      return [];
    }
  }

  async deleteSave(filepath: string): Promise<void> {
    try {
      await fs.unlink(filepath);
    } catch (error) {
      // File might not exist
    }
  }
}

