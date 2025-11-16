export interface GameConfig {
  // Encounter settings
  encounterChance: number // Base chance for NPC encounters (0-100)
  encounterCooldown: number // Days before same NPC can have another encounter
  
  // Progression settings
  xpMultiplier: number // Multiplier for XP gains (1.0 = normal)
  levelUpXpMultiplier: number // Multiplier for XP needed per level (1.0 = normal)
  statPointsPerLevel: number // Stat points gained on level up
  skillImprovementChance: number // Chance to improve skill after action (0-100)
  
  // NPC progression
  npcXpMultiplier: number // Multiplier for NPC XP gains
  npcLevelUpXpMultiplier: number // Multiplier for NPC XP needed per level
  npcGrowthRate: number // Base growth rate for NPCs (0-100)
  
  // World progression
  worldEventChance: number // Chance for major world events (0-100)
  worldEventInterval: number // Minimum days between world events
  seasonLength: number // Days per season
  
  // Action settings
  actionSuccessBonus: number // Bonus to action success chance (0-100)
  actionRewardMultiplier: number // Multiplier for action rewards (1.0 = normal)
  
  // Stamina settings
  baseStamina: number // Base stamina per day
  staminaRegenBonus: number // Bonus stamina from high morale
  
  // Relationship settings
  relationshipGainMultiplier: number // Multiplier for relationship gains (1.0 = normal)
  relationshipDecayRate: number // Relationship decay per day (0-100)
  
  // Difficulty settings
  difficulty: 'Easy' | 'Normal' | 'Hard' | 'Custom'
}

export class GameConfigManager {
  private config: GameConfig

  constructor(config?: Partial<GameConfig>) {
    if (config) {
      this.config = { ...this.getDefaultConfig(), ...config }
    } else {
      this.config = this.getDefaultConfig()
    }
  }

  getDefaultConfig(): GameConfig {
    return {
      // Encounter settings
      encounterChance: 40, // 40% base chance
      encounterCooldown: 5, // 5 days cooldown
      
      // Progression settings
      xpMultiplier: 1.0,
      levelUpXpMultiplier: 1.0,
      statPointsPerLevel: 2,
      skillImprovementChance: 30, // 30% chance
      
      // NPC progression
      npcXpMultiplier: 1.0,
      npcLevelUpXpMultiplier: 1.0,
      npcGrowthRate: 50, // 50% base rate
      
      // World progression
      worldEventChance: 20, // 20% chance
      worldEventInterval: 10, // Every 10 days minimum
      seasonLength: 30, // 30 days per season
      
      // Action settings
      actionSuccessBonus: 0, // No bonus
      actionRewardMultiplier: 1.0,
      
      // Stamina settings
      baseStamina: 5,
      staminaRegenBonus: 1,
      
      // Relationship settings
      relationshipGainMultiplier: 1.0,
      relationshipDecayRate: 0, // No decay by default
      
      // Difficulty
      difficulty: 'Normal'
    }
  }

  getConfig(): GameConfig {
    return { ...this.config }
  }

  updateConfig(updates: Partial<GameConfig>): void {
    this.config = { ...this.config, ...updates }
  }

  setDifficulty(difficulty: 'Easy' | 'Normal' | 'Hard'): void {
    this.config.difficulty = difficulty
    
    switch (difficulty) {
      case 'Easy':
        this.config.xpMultiplier = 1.5
        this.config.levelUpXpMultiplier = 0.8
        this.config.actionSuccessBonus = 10
        this.config.actionRewardMultiplier = 1.2
        this.config.baseStamina = 7
        this.config.encounterChance = 50
        this.config.relationshipGainMultiplier = 1.3
        break
      
      case 'Normal':
        this.config = this.getDefaultConfig()
        break
      
      case 'Hard':
        this.config.xpMultiplier = 0.7
        this.config.levelUpXpMultiplier = 1.3
        this.config.actionSuccessBonus = -5
        this.config.actionRewardMultiplier = 0.8
        this.config.baseStamina = 4
        this.config.encounterChance = 30
        this.config.relationshipGainMultiplier = 0.8
        break
    }
  }

  // Helper methods to get specific config values
  getEncounterChance(): number {
    return Math.max(0, Math.min(100, this.config.encounterChance))
  }

  getXpMultiplier(): number {
    return Math.max(0.1, this.config.xpMultiplier)
  }

  getLevelUpXpMultiplier(): number {
    return Math.max(0.1, this.config.levelUpXpMultiplier)
  }

  getActionRewardMultiplier(): number {
    return Math.max(0.1, this.config.actionRewardMultiplier)
  }

  getSkillImprovementChance(): number {
    return Math.max(0, Math.min(100, this.config.skillImprovementChance))
  }
}

