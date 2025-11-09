import readlineSync from 'readline-sync';
import { GameLoop } from './gameLoop.js';
import type { Player, Tribe, NPC, Event } from './types.js';

export class CLI {
  private game: GameLoop;

  constructor(game: GameLoop) {
    this.game = game;
  }

  clearScreen(): void {
    console.log('\n'.repeat(50));
  }

  printHeader(): void {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('          THREE TRIBES CHRONICLE - v0.1');
    console.log('═══════════════════════════════════════════════════════════\n');
  }

  printPlayerStatus(): void {
    const player = this.game.getPlayer();
    const tribe = this.game.getTribe();
    const stamina = this.game.getCurrentStamina();
    const maxStamina = this.game.getMaxStamina();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 CHARACTER STATUS`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Name: ${player.name} | Tribe: ${player.tribe} | Job: ${player.job}`);
    console.log(`Level: ${player.level} | XP: ${player.xp}/${player.level * 10} | Day: ${this.game.getDay()}`);
    console.log(`Stamina: ${stamina}/${maxStamina} ⚡`);
    console.log(`\n📈 STATS:`);
    console.log(`  STR: ${player.stats.str} | DEX: ${player.stats.dex} | WIS: ${player.stats.wis}`);
    console.log(`  CHA: ${player.stats.cha} | LCK: ${player.stats.luck}`);
    console.log(`\n🎯 SKILLS:`);
    console.log(`  Farming: ${player.skills.farming} | Gathering: ${player.skills.gathering}`);
    console.log(`  Trading: ${player.skills.trading} | Social: ${player.skills.social}`);
    console.log(`\n💼 INVENTORY:`);
    console.log(`  Food: ${player.inventory.food} | Materials: ${player.inventory.materials} | Wealth: ${player.inventory.wealth}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  printTribeStatus(): void {
    const tribe = this.game.getTribe();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🏛️  ${tribe.name.toUpperCase()} TRIBE STATUS`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 ATTRIBUTES:`);
    console.log(`  Prosperity: ${tribe.attributes.prosperity} | Defense: ${tribe.attributes.defense}`);
    console.log(`  Knowledge: ${tribe.attributes.knowledge} | Spirit: ${tribe.attributes.spirit}`);
    console.log(`  Morale: ${tribe.attributes.morale}`);
    console.log(`\n📦 RESOURCES:`);
    console.log(`  Food: ${tribe.resources.food} | Materials: ${tribe.resources.materials}`);
    console.log(`  Wealth: ${tribe.resources.wealth} | Spirit Energy: ${tribe.resources.spirit_energy}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  printNPCs(): void {
    const player = this.game.getPlayer();
    const npcs = this.game.getNPCsByTribe(player.tribe);

    if (npcs.length === 0) {
      console.log('No NPCs available in your tribe.\n');
      return;
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👥 TRIBAL MEMBERS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    npcs.forEach(npc => {
      const relationship = this.game.getPlayer().relationships[npc.id] || 50;
      let relationshipText = '';
      if (relationship < 20) relationshipText = '🔴 Hostile';
      else if (relationship < 50) relationshipText = '🟡 Neutral';
      else if (relationship < 80) relationshipText = '🟢 Friendly';
      else relationshipText = '💚 Ally';

      console.log(`  ${npc.name} (${npc.role}) - ${relationshipText} (${relationship})`);
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  showMainMenu(): string {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 ACTIONS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  1. 🌾 Farm (1 stamina) - Tend fields, gain food');
    console.log('  2. 🌿 Gather (1 stamina) - Collect materials');
    console.log('  3. 💰 Trade (1 stamina) - Exchange goods');
    console.log('  4. 👥 Visit NPC (1 stamina) - Socialize with tribe members');
    console.log('  5. 📊 View Status - Check your stats and tribe');
    console.log('  6. 👥 View NPCs - See available tribe members');
    console.log('  7. 💾 Save Game');
    console.log('  8. 🌙 End Day - Rest and start a new day');
    console.log('  9. ❌ Quit');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const choice = readlineSync.question('Choose an action (1-9): ');
    return choice.trim();
  }

  handleAction(action: string): void {
    const stamina = this.game.getCurrentStamina();
    
    if (stamina <= 0 && ['1', '2', '3', '4'].includes(action)) {
      console.log('\n⚠️  You are too tired! End the day to rest and restore stamina.\n');
      readlineSync.question('Press Enter to continue...');
      return;
    }

    let result: any;
    let npcId: string | undefined;

    switch (action) {
      case '1':
        result = this.game.executeAction('farm');
        break;
      
      case '2':
        result = this.game.executeAction('gather');
        break;
      
      case '3':
        result = this.game.executeAction('trade');
        break;
      
      case '4':
        const npcs = this.game.getNPCsByTribe(this.game.getPlayer().tribe);
        if (npcs.length === 0) {
          console.log('\n⚠️  No NPCs available to visit.\n');
          readlineSync.question('Press Enter to continue...');
          return;
        }
        console.log('\n👥 Available NPCs:');
        npcs.forEach((npc, index) => {
          const rel = this.game.getPlayer().relationships[npc.id] || 50;
          console.log(`  ${index + 1}. ${npc.name} (${npc.role}) - Relationship: ${rel}`);
        });
        const npcChoice = readlineSync.question('\nChoose an NPC (number): ');
        const npcIndex = parseInt(npcChoice, 10) - 1;
        if (npcIndex >= 0 && npcIndex < npcs.length) {
          npcId = npcs[npcIndex].id;
          result = this.game.executeAction('visit', npcId);
        } else {
          console.log('Invalid choice.');
          readlineSync.question('Press Enter to continue...');
          return;
        }
        break;
      
      case '5':
        this.printPlayerStatus();
        this.printTribeStatus();
        readlineSync.question('Press Enter to continue...');
        return;
      
      case '6':
        this.printNPCs();
        readlineSync.question('Press Enter to continue...');
        return;
      
      case '7':
        this.handleSave();
        return;
      
      case '8':
        this.handleEndDay();
        return;
      
      case '9':
        console.log('\n👋 Farewell, traveler. May your tribe prosper!');
        process.exit(0);
      
      default:
        console.log('\n⚠️  Invalid choice. Please try again.\n');
        readlineSync.question('Press Enter to continue...');
        return;
    }

    if (result) {
      console.log(`\n${result.message}\n`);
      
      if (result.event) {
        console.log(`\n⚡ EVENT: ${result.event.text}\n`);
      }
      
      if (result.npcEvent) {
        console.log(`\n⚡ NPC EVENT: ${result.npcEvent.text}\n`);
      }

      if (result.rewards) {
        const rewards: string[] = [];
        if (result.rewards.xp) rewards.push(`+${result.rewards.xp} XP`);
        if (result.rewards.food) rewards.push(`+${result.rewards.food} Food`);
        if (result.rewards.materials) rewards.push(`+${result.rewards.materials} Materials`);
        if (result.rewards.wealth) rewards.push(`${result.rewards.wealth > 0 ? '+' : ''}${result.rewards.wealth} Wealth`);
        if (result.rewards.spirit_energy) rewards.push(`+${result.rewards.spirit_energy} Spirit Energy`);
        
        if (rewards.length > 0) {
          console.log(`📦 Rewards: ${rewards.join(', ')}\n`);
        }
      }
    }

    readlineSync.question('Press Enter to continue...');
  }

  async handleSave(): Promise<void> {
    try {
      const filepath = await this.game.saveGame();
      console.log(`\n✅ Game saved to: ${filepath}\n`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';
      console.log(`\n❌ Error saving game: ${errorMessage}\n`);
      if (errorStack) {
        console.log(`Stack trace: ${errorStack}\n`);
      }
    }
    readlineSync.question('Press Enter to continue...');
  }

  handleEndDay(): void {
    console.log('\n🌙 Ending the day...\n');
    this.game.endDay();
    console.log('✨ A new day begins! Your stamina has been restored.\n');
    
    const player = this.game.getPlayer();
    const tribe = this.game.getTribe();
    
    console.log(`📅 Day ${this.game.getDay()} Summary:`);
    console.log(`  Your level: ${player.level}`);
    console.log(`  Tribe prosperity: ${tribe.attributes.prosperity}`);
    console.log(`  Tribe morale: ${tribe.attributes.morale}\n`);
    
    readlineSync.question('Press Enter to continue...');
  }

  displayEvent(event: Event): void {
    console.log('\n⚡═══════════════════════════════════════════════════════════');
    console.log(`   ${event.text}`);
    console.log('═══════════════════════════════════════════════════════════\n');
  }

  async showLoadMenu(): Promise<boolean> {
    const saves = await this.game.listSaves();
    
    if (saves.length === 0) {
      console.log('\n⚠️  No saved games found.\n');
      return false;
    }

    console.log('\n📂 Available Saves:');
    saves.forEach((save, index) => {
      console.log(`  ${index + 1}. ${save}`);
    });
    console.log(`  ${saves.length + 1}. Cancel\n`);

    const choice = readlineSync.question('Choose a save file (number): ');
    const index = parseInt(choice, 10) - 1;

    if (index >= 0 && index < saves.length) {
      try {
        await this.game.loadGame(saves[index]);
        console.log('\n✅ Game loaded successfully!\n');
        return true;
      } catch (error) {
        console.log(`\n❌ Error loading game: ${error}\n`);
        return false;
      }
    }

    return false;
  }

  async showStartMenu(): Promise<void> {
    this.printHeader();
    console.log('  1. 🆕 New Game');
    console.log('  2. 📂 Load Game');
    console.log('  3. ❌ Quit\n');

    const choice = readlineSync.question('Choose an option (1-3): ');

    switch (choice) {
      case '1':
        await this.handleNewGame();
        break;
      case '2':
        const loaded = await this.showLoadMenu();
        if (loaded) {
          this.startGameLoop();
        } else {
          readlineSync.question('Press Enter to continue...');
          this.showStartMenu();
        }
        break;
      case '3':
        console.log('\n👋 Farewell!');
        process.exit(0);
      default:
        console.log('\n⚠️  Invalid choice.\n');
        readlineSync.question('Press Enter to continue...');
        this.showStartMenu();
    }
  }

  async handleNewGame(): Promise<void> {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎮 NEW GAME');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const name = readlineSync.question('Enter your character name: ');
    if (name.trim()) {
      this.game.setPlayerName(name.trim());
    }

    console.log('\n🏛️  Choose your tribe:');
    console.log('  1. Stonefang - Earth-bound warriors and builders');
    console.log('  2. Windveil - Agile hunters and spirit-guides');
    console.log('  3. Emberroot - Scholars and mystics\n');

    const tribeChoice = readlineSync.question('Choose a tribe (1-3, default: 1): ');
    const tribes = ['Stonefang', 'Windveil', 'Emberroot'];
    const tribeIndex = parseInt(tribeChoice, 10) - 1;
    const selectedTribe = (tribeIndex >= 0 && tribeIndex < 3) ? tribes[tribeIndex] : 'Stonefang';
    
    this.game.setPlayerTribe(selectedTribe);
    
    console.log(`\n✅ Welcome to ${selectedTribe}, ${this.game.getPlayer().name}!\n`);
    readlineSync.question('Press Enter to begin your journey...');
    
    this.startGameLoop();
  }

  startGameLoop(): void {
    // Set up event handlers
    this.game.setOnEvent((event) => {
      this.displayEvent(event);
    });

    this.game.setOnDayEnd((day, player, tribe) => {
      // Day end summary can be shown here if needed
    });

    // Start the first day
    this.game.startDay();

    // Main game loop
    while (true) {
      this.clearScreen();
      this.printHeader();
      this.printPlayerStatus();
      this.printTribeStatus();
      
      const choice = this.showMainMenu();
      this.handleAction(choice);
    }
  }

  run(): void {
    this.showStartMenu();
  }
}

