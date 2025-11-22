import { PlayerManager } from './core/player.js'
import { TribeManager } from './core/tribe.js'
import { NPCManager } from './core/npc.js'
import { EventManager } from './core/events.js'
import { ActionManager } from './core/actions.js'
import { SaveManager, type SaveData } from './core/saveLoad.js'
import { WorldManager, type WorldState } from './core/world.js'
import { EncounterManager, type EncounterEvent } from './core/encounters.js'
import { GameConfigManager, type GameConfig } from './core/gameConfig.js'
import type { Player, Tribe, NPC, Event, Item, EquipmentSlots } from './types.js'

export class GameLoop {
  private playerManager: PlayerManager
  private tribeManager: TribeManager
  private npcManager: NPCManager
  private eventManager: EventManager
  private actionManager: ActionManager
  private saveManager: SaveManager
  private worldManager: WorldManager
  private encounterManager: EncounterManager
  private configManager: GameConfigManager
  private day: number
  private onDayEnd?: (day: number, player: Player, tribe: Tribe) => void
  private onEvent?: (event: Event) => void
  private lastNPCEncounters: Map<string, { day: number; level: number }> = new Map()

  constructor(
    player?: Player,
    tribe?: Tribe,
    npcs: NPC[] = [],
    events: Event[] = [],
    worldState?: WorldState,
    gameConfig?: Partial<GameConfig>
  ) {
    this.playerManager = new PlayerManager(player)
    this.tribeManager = new TribeManager(tribe)
    this.npcManager = new NPCManager(npcs)
    this.eventManager = new EventManager(events)
    this.actionManager = new ActionManager(this.playerManager, this.tribeManager)
    this.saveManager = new SaveManager()
    this.worldManager = new WorldManager(worldState)
    this.encounterManager = new EncounterManager()
    this.configManager = new GameConfigManager(gameConfig)
    this.day = 1
  }

  setOnDayEnd(callback: (day: number, player: Player, tribe: Tribe) => void): void {
    this.onDayEnd = callback
  }

  setOnEvent(callback: (event: Event) => void): void {
    this.onEvent = callback
  }

  startDay(): void {
    const player = this.playerManager.getPlayer()
    const tribe = this.tribeManager.getTribe()
    const config = this.configManager.getConfig()

    // Restore stamina with morale bonus
    const staminaRegen = this.tribeManager.getStaminaRegenBonus()
    const totalStaminaRegen = staminaRegen + config.staminaRegenBonus
    this.playerManager.restoreStamina(config.baseStamina, totalStaminaRegen)

    // Check for daily event
    const dailyEvent = this.eventManager.checkDailyEvent()
    if (dailyEvent) {
      this.eventManager.applyEventEffects(dailyEvent, this.tribeManager, player)
      if (this.onEvent) {
        this.onEvent(dailyEvent)
      }
    }

    // Check for tribe milestone
    const milestoneEvent = this.eventManager.checkTribeMilestone(tribe)
    if (milestoneEvent) {
      this.eventManager.applyEventEffects(milestoneEvent, this.tribeManager, player)
      if (this.onEvent) {
        this.onEvent(milestoneEvent)
      }
    }
  }

  executeAction(actionType: string, npcId?: string, combatDecision?: 'fight' | 'flee'): any {
    // Check for action event
    const actionEvent = this.eventManager.checkActionEvent(actionType)

    const result = this.actionManager.executeAction(actionType as any, npcId)
    
    // Handle explore encounters with combat
    if (actionType === 'explore' && result.exploreEncounter && combatDecision) {
      if (combatDecision === 'fight') {
        const combatResult = this.actionManager.executeCombat(result.exploreEncounter.animal)
        result.combatResult = combatResult
        result.message = combatResult.message
        if (combatResult.victory && combatResult.rewards) {
          result.rewards = combatResult.rewards
        }
      } else {
        // Player fled - take some damage but less than fighting
        const player = this.playerManager.getPlayer()
        const fleeDamage = Math.floor(result.exploreEncounter.animal.damage * 0.3)
        this.playerManager.takeDamage(fleeDamage)
        result.message = `You fled from the ${result.exploreEncounter.animal.name} but took ${fleeDamage} damage in the escape.`
        result.combatResult = {
          victory: false,
          damageTaken: fleeDamage,
          damageDealt: 0,
          message: result.message
        }
      }
      // Remove the encounter flag since it's been resolved
      delete result.exploreEncounter
    }

    // Apply action event if triggered
    if (actionEvent) {
      this.eventManager.applyEventEffects(actionEvent, this.tribeManager, this.playerManager.getPlayer())
      if (this.onEvent) {
        this.onEvent(actionEvent)
      }
      result.event = actionEvent
    }

    // Check for NPC encounter events if visiting
    if (actionType === "visit" && npcId) {
      const player = this.playerManager.getPlayer()
      const npc = this.npcManager.getNPC(npcId)
      
        if (npc) {
        // Mark NPC as encountered
        npc.encountered = true
        if (!npc.flags) npc.flags = {};
        npc.flags.met = true
        
        // Record encounter
        this.worldManager.recordNPCEncounter(npcId, this.day)
        const lastEncounter = this.lastNPCEncounters.get(npcId)
        const daysSince = this.worldManager.getDaysSinceEncounter(npcId, this.day)
        const lastLevel = lastEncounter?.level || 1
        const currentLevel = npc.level || 1

        // Check for encounter events
        const worldState = this.worldManager.getWorldState()
        const availableEncounters = this.encounterManager.getAvailableEncounters(
          npc,
          player,
          worldState,
          daysSince
        )

        const encounterChance = this.configManager.getEncounterChance() / 100
        if (availableEncounters.length > 0 && Math.random() < encounterChance) {
          // Configurable chance to trigger an encounter
          const encounter = availableEncounters[Math.floor(Math.random() * availableEncounters.length)]
          const encounterResult = this.encounterManager.executeEncounter(encounter, npc, player)

          // Apply encounter rewards
          if (encounterResult.rewards) {
            if (encounterResult.rewards.xp) {
              const xpMultiplier = this.configManager.getXpMultiplier()
              const levelUpMultiplier = this.configManager.getLevelUpXpMultiplier()
              this.playerManager.addXP(encounterResult.rewards.xp, xpMultiplier, levelUpMultiplier)
            }
            if (encounterResult.rewards.statBonus) {
              Object.entries(encounterResult.rewards.statBonus).forEach(([stat, value]) => {
                this.playerManager.improveStat(stat as any, value || 1)
              })
            }
            if (encounterResult.rewards.skillBonus) {
              Object.entries(encounterResult.rewards.skillBonus).forEach(([skill, value]) => {
                this.playerManager.improveSkill(skill as any, value || 1)
              })
            }
            if (encounterResult.rewards.items) {
              this.playerManager.updateInventory(encounterResult.rewards.items)
            }
            if (encounterResult.rewards.food) {
              this.playerManager.updateInventory({ food: encounterResult.rewards.food })
            }
            if (encounterResult.rewards.materials) {
              this.playerManager.updateInventory({ materials: encounterResult.rewards.materials })
            }
            if (encounterResult.rewards.wealth) {
              this.playerManager.updateInventory({ wealth: encounterResult.rewards.wealth })
            }
            if (encounterResult.rewards.spirit_energy) {
              this.playerManager.updateInventory({ spirit_energy: encounterResult.rewards.spirit_energy })
            }
            if (encounterResult.rewards.relationship) {
              this.playerManager.updateRelationship(npcId, encounterResult.rewards.relationship)
            }
          }

          // Apply world effects
          if (encounterResult.effects) {
            // World effects would be applied to world state
            // This could affect future events
          }

          result.encounter = encounterResult
        }

        // Update last encounter record
        this.lastNPCEncounters.set(npcId, { day: this.day, level: currentLevel })

        // Check for regular NPC event
        const relationship = this.playerManager.getRelationship(npcId)
        const npcEvent = this.eventManager.checkNPCEvent(npcId, relationship)
        if (npcEvent) {
          this.eventManager.applyEventEffects(npcEvent, this.tribeManager, player)
          if (this.onEvent) {
            this.onEvent(npcEvent)
          }
          result.npcEvent = npcEvent
        }
      }
    }

    return result
  }

  endDay(): string[] {
    this.day += 1
    this.eventManager.resetDailyEvents()

    const player = this.playerManager.getPlayer()
    const tribe = this.tribeManager.getTribe()

    // Advance world state
    const worldProgression = this.worldManager.advanceDay(this.day)
    const worldMessages: string[] = []

    if (worldProgression.seasonChanged) {
      worldMessages.push(`🌍 Season changed to ${this.worldManager.getWorldState().season}`)
    }

    if (worldProgression.majorEvent) {
      worldMessages.push(`🌍 World Event: ${worldProgression.majorEvent}`)
      if (this.onEvent) {
        // Create a pseudo-event for world events
        const worldEvent: Event = {
          id: `world_event_${this.day}`,
          type: 'daily',
          text: worldProgression.majorEvent,
          effects: worldProgression.worldChanges
        }
        this.onEvent(worldEvent)
      }
    }

    // Process NPC growth
    const relationshipBonus: Record<string, number> = {}
    Object.entries(player.relationships).forEach(([npcId, rel]) => {
      relationshipBonus[npcId] = rel
    })
    const growthMessages = this.npcManager.processNPCGrowth(this.day, relationshipBonus)

    if (this.onDayEnd) {
      this.onDayEnd(this.day - 1, player, tribe)
    }

    // Process rest day if player is resting
    if (this.playerManager.isResting()) {
      const restDaysBefore = this.playerManager.getRestDaysRemaining();
      this.playerManager.processRestDay();
      const restDaysAfter = this.playerManager.getRestDaysRemaining();
      const player = this.playerManager.getPlayer();
      
      if (restDaysAfter > 0) {
        growthMessages.push(`💤 You are resting to recover. ${restDaysAfter} day${restDaysAfter > 1 ? 's' : ''} remaining. Health: ${player.health}/${player.maxHealth}`);
      } else {
        growthMessages.push(`✅ You have fully recovered! Your health has been restored to ${player.maxHealth}.`);
      }
    }

    // Start the new day (restores stamina only if not resting)
    // If resting, don't restore stamina - player needs to rest
    if (!this.playerManager.isResting()) {
      this.startDay();
    }

    // Return all messages for display
    return [...worldMessages, ...growthMessages]
  }

  getPlayer(): Player {
    return this.playerManager.getPlayer()
  }

  getTribe(): Tribe {
    return this.tribeManager.getTribe()
  }

  getNPCs(): NPC[] {
    return this.npcManager.getAllNPCs()
  }

  getGameConfig(): GameConfig {
    return this.configManager.getConfig()
  }

  getNPCsByTribe(tribe: string): NPC[] {
    return this.npcManager.getNPCsByTribe(tribe)
  }

  getNPC(id: string): NPC | undefined {
    return this.npcManager.getNPC(id)
  }

  getDay(): number {
    return this.day
  }

  getCurrentStamina(): number {
    return this.playerManager.getCurrentStamina()
  }

  getMaxStamina(): number {
    // Return the maxStamina that was set during restoreStamina
    // This ensures consistency with what was actually restored
    return this.playerManager.getMaxStamina()
  }

  getHealth(): number {
    return this.playerManager.getHealth()
  }

  getMaxHealth(): number {
    return this.playerManager.getMaxHealth()
  }

  isResting(): boolean {
    return this.playerManager.isResting()
  }

  getRestDaysRemaining(): number {
    return this.playerManager.getRestDaysRemaining()
  }

  // Bag/Inventory methods
  getBag() {
    return this.playerManager.getBag()
  }

  getEquipment() {
    return this.playerManager.getEquipment()
  }

  equipItem(itemId: string, slot: string) {
    const bag = this.playerManager.getBag()
    const item = bag.find((i: Item) => i.id === itemId)
    if (!item) {
      return { success: false, message: 'Item not found in bag.' }
    }
    return this.playerManager.equipItem(item, slot as keyof EquipmentSlots)
  }

  unequipItem(slot: string) {
    return this.playerManager.unequipItem(slot as keyof EquipmentSlots)
  }

  consumeItem(itemId: string) {
    return this.playerManager.consumeItem(itemId)
  }

  sellItem(itemId: string, sellValue?: number): { success: boolean; message: string; wealthGained: number } {
    return this.playerManager.sellItem(itemId, sellValue)
  }

  getEffectiveStats() {
    return this.playerManager.getEffectiveStats()
  }

  executeCombat(animal: any): any {
    return this.actionManager.executeCombat(animal)
  }

  setPlayerName(name: string): void {
    this.playerManager.setName(name)
  }

  setPlayerTribe(tribe: string): void {
    this.playerManager.setTribe(tribe)
  }

  async saveGame(): Promise<string> {
    try {
      const player = this.playerManager.getPlayer()
      const tribe = this.tribeManager.getTribe()
      const npcs = this.npcManager.getAllNPCs()
      const worldState = this.worldManager.getWorldState()
      const gameConfig = this.configManager.getConfig()

      // Validate data before saving
      if (!player || !tribe || !npcs) {
        throw new Error('Missing game data: player, tribe, or npcs is undefined')
      }

      return await this.saveManager.saveGame(
        player,
        tribe,
        npcs,
        this.day,
        worldState,
        Object.fromEntries(this.lastNPCEncounters),
        gameConfig
      )
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`GameLoop.saveGame failed: ${errorMessage}`)
    }
  }

  getSaveData(): SaveData {
    const player = this.playerManager.getPlayer()
    const tribe = this.tribeManager.getTribe()
    const npcs = this.npcManager.getAllNPCs()
    const worldState = this.worldManager.getWorldState()
    const gameConfig = this.configManager.getConfig()

    return {
      player,
      tribe,
      npcs,
      day: this.day,
      timestamp: Date.now(),
      worldState,
      lastNPCEncounters: Object.fromEntries(this.lastNPCEncounters),
      gameConfig
    }
  }

  async loadGame(filepath: string): Promise<void> {
    try {
      const saveData = await this.saveManager.loadGame(filepath)
      await this.loadGameFromData(saveData)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to load game: ${errorMessage}`)
    }
  }

  async loadGameFromData(saveData: SaveData): Promise<void> {
    try {
      // Validate save data
      if (!saveData.player) {
        throw new Error('Save file is missing player data')
      }
      if (!saveData.tribe) {
        throw new Error('Save file is missing tribe data')
      }
      if (!saveData.npcs) {
        throw new Error('Save file is missing NPC data')
      }

      this.playerManager = new PlayerManager(saveData.player)
      this.tribeManager = new TribeManager(saveData.tribe)
      this.npcManager = new NPCManager(saveData.npcs)
      this.configManager = new GameConfigManager(saveData.gameConfig)
      this.actionManager = new ActionManager(this.playerManager, this.tribeManager, this.configManager)
      this.worldManager = new WorldManager(saveData.worldState)
      this.day = saveData.day || 1

      // Restore last NPC encounters
      if (saveData.lastNPCEncounters) {
        this.lastNPCEncounters = new Map(Object.entries(saveData.lastNPCEncounters))
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to load game data: ${errorMessage}`)
    }
  }

  async listSaves(): Promise<string[]> {
    return await this.saveManager.listSaves()
  }

  /**
   * Manually trigger NPC growth (for events or special interactions)
   */
  triggerNPCGrowth(npcId: string, xpAmount: number): boolean {
    return this.npcManager.addXP(npcId, xpAmount)
  }

  /**
   * Get NPC details including stats and level
   */
  getNPCDetails(npcId: string): { level: number; stats: any } | undefined {
    const npc = this.npcManager.getNPC(npcId)
    if (!npc) return undefined
    return {
      level: npc.level || 1,
      stats: npc.stats
    }
  }

  getWorldState(): WorldState {
    return this.worldManager.getWorldState()
  }

  getAvailableEncounters(npcId: string): EncounterEvent[] {
    const npc = this.npcManager.getNPC(npcId)
    const player = this.playerManager.getPlayer()
    const worldState = this.worldManager.getWorldState()
    
    if (!npc) return []
    
    const daysSince = this.worldManager.getDaysSinceEncounter(npcId, this.day)
    return this.encounterManager.getAvailableEncounters(npc, player, worldState, daysSince)
  }

  updateGameConfig(updates: Partial<GameConfig>): void {
    this.configManager.updateConfig(updates)
  }

  setDifficulty(difficulty: 'Easy' | 'Normal' | 'Hard'): void {
    this.configManager.setDifficulty(difficulty)
  }
}

