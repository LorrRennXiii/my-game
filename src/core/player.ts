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
      relationships: {},
      flags: {}
    };
  }

  getPlayer(): Player {
    return { ...this.player };
  }

  getEffectiveStamina(): number {
    // effective_stamina = base_stamina + stamina_bonus_from_skills - fatigue_penalty
    const staminaBonus = Math.floor((this.player.skills.farming + this.player.skills.gathering) / 3);
    const fatiguePenalty = 0; // Can be implemented later based on consecutive days
    return this.player.maxStamina + staminaBonus - fatiguePenalty;
  }

  getCurrentStamina(): number {
    return this.player.stamina;
  }

  spendStamina(amount: number): boolean {
    if (this.player.stamina >= amount) {
      this.player.stamina -= amount;
      return true;
    }
    return false;
  }

  restoreStamina(): void {
    this.player.stamina = this.getEffectiveStamina();
  }

  addXP(amount: number): boolean {
    this.player.xp += amount;
    const levelUpThreshold = this.player.level * 10;
    
    if (this.player.xp >= levelUpThreshold) {
      this.levelUp();
      return true;
    }
    return false;
  }

  private levelUp(): void {
    this.player.level += 1;
    this.player.xp = 0;
    
    // Distribute stat points on level up
    const statPoints = 2;
    // For now, auto-distribute evenly (can be made player choice later)
    const stats = ['str', 'dex', 'wis', 'cha', 'luck'] as const;
    for (let i = 0; i < statPoints; i++) {
      const stat = stats[Math.floor(Math.random() * stats.length)];
      this.player.stats[stat] += 1;
    }
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

  updateRelationship(npcId: string, change: number): void {
    if (!this.player.relationships[npcId]) {
      this.player.relationships[npcId] = 50; // Start neutral
    }
    this.player.relationships[npcId] = Math.max(0, Math.min(100, 
      this.player.relationships[npcId] + change
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
}

