import type { Player, PlayerStats, PlayerSkills, PlayerInventory } from '../types.js';

export class PlayerManager {
  private player: Player;

  constructor(player?: Player) {
    if (player) {
      this.player = player;
    } else {
      this.player = this.createDefaultPlayer();
    }
  }

  private createDefaultPlayer(): Player {
    return {
      name: "Aro",
      tribe: "Stonefang",
      job: "Civilian",
      level: 1,
      xp: 0,
      stats: {
        str: 3,
        dex: 3,
        wis: 3,
        cha: 3,
        luck: 3
      },
      skills: {
        farming: 0,
        gathering: 0,
        trading: 0,
        social: 0
      },
      inventory: {
        food: 10,
        materials: 5,
        wealth: 20
      },
      stamina: 5,
      maxStamina: 5,
      health: 100,
      maxHealth: 100,
      relationships: {},
      flags: {}
    };
  }

  getPlayer(): Player {
    return { ...this.player };
  }

  getEffectiveStamina(baseStamina: number = 5, staminaRegenBonus: number = 1): number {
    // effective_stamina = base_stamina + stamina_bonus_from_skills - fatigue_penalty
    const staminaBonus = Math.floor((this.player.skills.farming + this.player.skills.gathering) / 3);
    const fatiguePenalty = 0; // Can be implemented later based on consecutive days
    return baseStamina + staminaBonus + staminaRegenBonus - fatiguePenalty;
  }

  getCurrentStamina(): number {
    return this.player.stamina;
  }

  getMaxStamina(): number {
    return this.player.maxStamina;
  }

  spendStamina(amount: number): boolean {
    if (this.player.stamina >= amount) {
      this.player.stamina -= amount;
      return true;
    }
    return false;
  }

  restoreStamina(baseStamina: number = 5, staminaRegenBonus: number = 1): void {
    // Calculate effective stamina (base + bonuses)
    const effectiveStamina = this.getEffectiveStamina(baseStamina, staminaRegenBonus);
    
    // Restore stamina to maxStamina (which includes level-up increases)
    // But don't exceed the effective stamina calculation
    // This preserves level-up increases while respecting skill/morale bonuses
    const targetStamina = Math.max(effectiveStamina, this.player.maxStamina);
    
    // Only update maxStamina if effective stamina is higher (from skills/morale)
    // Otherwise preserve the level-up increased maxStamina
    if (effectiveStamina > this.player.maxStamina) {
      this.player.maxStamina = effectiveStamina;
    }
    
    // Restore current stamina to maxStamina
    this.player.stamina = this.player.maxStamina;
  }

  addXP(amount: number, xpMultiplier: number = 1.0, levelUpMultiplier: number = 1.0): boolean {
    const adjustedAmount = Math.floor(amount * xpMultiplier);
    this.player.xp += adjustedAmount;
    const levelUpThreshold = Math.floor(this.player.level * 10 * levelUpMultiplier);
    
    if (this.player.xp >= levelUpThreshold) {
      this.levelUp();
      return true;
    }
    return false;
  }

  private levelUp(statPoints: number = 2): void {
    this.player.level += 1;
    this.player.xp = 0;
    
    // RNG for max stamina increase (90% chance for +1, 10% chance for +2)
    const staminaRoll = Math.random();
    const staminaIncrease = staminaRoll < 0.9 ? 1 : 2;
    this.player.maxStamina += staminaIncrease;
    this.player.stamina += staminaIncrease; // Also restore current stamina
    
    // RNG for max health increase (90% chance for +10, 10% chance for +20)
    const healthRoll = Math.random();
    const healthIncrease = healthRoll < 0.9 ? 10 : 20;
    this.player.maxHealth += healthIncrease;
    this.player.health += healthIncrease; // Also restore current health
    
    // RNG for stat points distribution
    // Each stat point has 90% chance to be +1, 10% chance to be +2
    const stats = ['str', 'dex', 'wis', 'cha', 'luck'] as const;
    for (let i = 0; i < statPoints; i++) {
      const stat = stats[Math.floor(Math.random() * stats.length)];
      const statRoll = Math.random();
      const statIncrease = statRoll < 0.9 ? 1 : 2;
      this.player.stats[stat] += statIncrease;
    }
  }

  setLevelUpStatPoints(statPoints: number): void {
    // This will be used by config manager
    // We'll need to store this in player or pass it to levelUp
  }

  improveSkill(skill: keyof PlayerSkills, amount: number = 1): void {
    if (this.player.skills[skill] !== undefined) {
      this.player.skills[skill] = (this.player.skills[skill] || 0) + amount;
    }
  }

  getSkillLevel(skill: keyof PlayerSkills): number {
    return this.player.skills[skill] || 0;
  }

  getStat(stat: keyof PlayerStats): number {
    return this.player.stats[stat];
  }

  improveStat(stat: keyof PlayerStats, amount: number = 1): void {
    this.player.stats[stat] = Math.max(1, this.player.stats[stat] + amount);
  }

  updateInventory(updates: Partial<PlayerInventory>): void {
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        this.player.inventory[key as keyof PlayerInventory] = 
          (this.player.inventory[key as keyof PlayerInventory] || 0) + value;
      }
    });
  }

  getInventory(): PlayerInventory {
    return { ...this.player.inventory };
  }

  updateRelationship(npcId: string, change: number, multiplier: number = 1.0): void {
    if (!this.player.relationships[npcId]) {
      this.player.relationships[npcId] = 50; // Start neutral
    }
    const adjustedChange = Math.floor(change * multiplier)
    this.player.relationships[npcId] = Math.max(0, Math.min(100, 
      this.player.relationships[npcId] + adjustedChange
    ));
  }

  getRelationship(npcId: string): number {
    return this.player.relationships[npcId] || 50;
  }

  setFlag(flag: string, value: boolean): void {
    this.player.flags[flag] = value;
  }

  getFlag(flag: string): boolean {
    return this.player.flags[flag] || false;
  }

  setName(name: string): void {
    this.player.name = name;
  }

  setTribe(tribe: string): void {
    this.player.tribe = tribe;
  }

  setJob(job: string): void {
    this.player.job = job;
  }

  getHealth(): number {
    return this.player.health;
  }

  getMaxHealth(): number {
    return this.player.maxHealth;
  }

  takeDamage(amount: number): void {
    this.player.health = Math.max(0, this.player.health - amount);
  }

  heal(amount: number): void {
    this.player.health = Math.min(this.player.maxHealth, this.player.health + amount);
  }

  restoreHealth(): void {
    this.player.health = this.player.maxHealth;
  }
}

