import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GameLoop } from './gameLoop.js';
import { CLI } from './cli.js';
import type { NPC, Event } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadJSON<T>(filename: string): T {
  // Go up from dist/ to project root, then into src/data
  const filepath = join(__dirname, '..', 'src', 'data', filename);
  const content = readFileSync(filepath, 'utf-8');
  return JSON.parse(content) as T;
}

async function main() {
  try {
    // Load game data
    const npcs: NPC[] = loadJSON<NPC[]>('npcs.json');
    const events: Event[] = loadJSON<Event[]>('events.json');

    // Initialize game
    const game = new GameLoop(undefined, undefined, npcs, events);
    
    // Start CLI
    const cli = new CLI(game);
    cli.run();
  } catch (error) {
    console.error('Error starting game:', error);
    process.exit(1);
  }
}

main();

