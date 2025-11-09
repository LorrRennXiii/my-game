import { PlayerManager } from './core/player.js';
import { TribeManager } from './core/tribe.js';
import { NPCManager } from './core/npc.js';
import { EventManager } from './core/events.js';
import { ActionManager } from './core/actions.js';
import { SaveManager } from './core/saveLoad.js';
import type { Player, Tribe, NPC, Event } from './types.js';

export class GameLoop {
  private playerManager: PlayerManager;
  private tribeManager: TribeManager;
  private npcManager: NPCManager;
  private eventManager: EventManager;
  private actionManager: ActionManager;
  private saveManager: SaveManager;
  private day: number;
  private onDayEnd?: (day: number, player: Player, tribe: Tribe) => void;
  private onEvent?: (event: Event) => void;

  constructor(
    player?: Player,
    tribe?: Tribe,
    npcs: NPC[] = [],
    events: Event[] = []
  ) {
    this.playerManager = new PlayerManager(player);
    this.tribeManager = new TribeManager(tribe);
    this.npcManager = new NPCManager(npcs);
    this.eventManager = new EventManager(events);
    this.actionManager = new ActionManager(this.playerManager, this.tribeManager);
    this.saveManager = new SaveManager();
    this.day = 1;
  }

  setOnDayEnd(callback: (day: number, player: Player, tribe: Tribe) => void): void {
    this.onDayEnd = callback;
  }

  setOnEvent(callback: (event: Event) => void): void {
    this.onEvent = callback;
  }

  startDay(): void {
    const player = this.playerManager.getPlayer();
    const tribe = this.tribeManager.getTribe();

    // Restore stamina with morale bonus
    const staminaRegen = this.tribeManager.getStaminaRegenBonus();
    this.playerManager.restoreStamina();
    if (staminaRegen > 0) {
      const currentStamina = this.playerManager.getCurrentStamina();
      this.playerManager.spendStamina(-staminaRegen); // Negative to add
    }

    // Check for daily event
    const dailyEvent = this.eventManager.checkDailyEvent();
    if (dailyEvent) {
      this.eventManager.applyEventEffects(dailyEvent, this.tribeManager, player);
      if (this.onEvent) {
        this.onEvent(dailyEvent);
      }
    }

    // Check for tribe milestone
    const milestoneEvent = this.eventManager.checkTribeMilestone(tribe);
    if (milestoneEvent) {
      this.eventManager.applyEventEffects(milestoneEvent, this.tribeManager, player);
      if (this.onEvent) {
        this.onEvent(milestoneEvent);
      }
    }
  }

  executeAction(actionType: string, npcId?: string): any {
    // Check for action event
    const actionEvent = this.eventManager.checkActionEvent(actionType);
    
    const result = this.actionManager.executeAction(actionType as any, npcId);
    
    // Apply action event if triggered
    if (actionEvent) {
      this.eventManager.applyEventEffects(actionEvent, this.tribeManager, this.playerManager.getPlayer());
      if (this.onEvent) {
        this.onEvent(actionEvent);
      }
      result.event = actionEvent;
    }

    // Check for NPC event if visiting
    if (actionType === "visit" && npcId) {
      const player = this.playerManager.getPlayer();
      const relationship = this.playerManager.getRelationship(npcId);
      const npcEvent = this.eventManager.checkNPCEvent(npcId, relationship);
      if (npcEvent) {
        this.eventManager.applyEventEffects(npcEvent, this.tribeManager, player);
        if (this.onEvent) {
          this.onEvent(npcEvent);
        }
        result.npcEvent = npcEvent;
      }
    }

    return result;
  }

  endDay(): void {
    this.day += 1;
    this.eventManager.resetDailyEvents();
    
    const player = this.playerManager.getPlayer();
    const tribe = this.tribeManager.getTribe();

    if (this.onDayEnd) {
      this.onDayEnd(this.day - 1, player, tribe);
    }
  }

  getPlayer(): Player {
    return this.playerManager.getPlayer();
  }

  getTribe(): Tribe {
    return this.tribeManager.getTribe();
  }

  getNPCs(): NPC[] {
    return this.npcManager.getAllNPCs();
  }

  getNPCsByTribe(tribe: string): NPC[] {
    return this.npcManager.getNPCsByTribe(tribe);
  }

  getNPC(id: string): NPC | undefined {
    return this.npcManager.getNPC(id);
  }

  getDay(): number {
    return this.day;
  }

  getCurrentStamina(): number {
    return this.playerManager.getCurrentStamina();
  }

  getMaxStamina(): number {
    return this.playerManager.getEffectiveStamina();
  }

  setPlayerName(name: string): void {
    this.playerManager.setName(name);
  }

  setPlayerTribe(tribe: string): void {
    this.playerManager.setTribe(tribe);
  }

  async saveGame(): Promise<string> {
    const player = this.playerManager.getPlayer();
    const tribe = this.tribeManager.getTribe();
    const npcs = this.npcManager.getAllNPCs();
    
    return await this.saveManager.saveGame(player, tribe, npcs, this.day);
  }

  async loadGame(filepath: string): Promise<void> {
    const saveData = await this.saveManager.loadGame(filepath);
    
    this.playerManager = new PlayerManager(saveData.player);
    this.tribeManager = new TribeManager(saveData.tribe);
    this.npcManager = new NPCManager(saveData.npcs);
    this.actionManager = new ActionManager(this.playerManager, this.tribeManager);
    this.day = saveData.day;
  }

  async listSaves(): Promise<string[]> {
    return await this.saveManager.listSaves();
  }
}

