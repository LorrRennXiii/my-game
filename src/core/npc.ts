import type { NPC, Player, NPCStats } from '../types.js'

export class NPCManager {
  private npcs: Map<string, NPC>

  constructor(npcs: NPC[] = []) {
    this.npcs = new Map()
    npcs.forEach(npc => {
      // Ensure NPC has default attributes if missing
      const npcWithDefaults = this.ensureNPCDefaults(npc)
      this.npcs.set(npcWithDefaults.id, npcWithDefaults)
    })
  }

  private ensureNPCDefaults(npc: NPC): NPC {
    // If NPC doesn't have stats or level, initialize them
    if (!npc.stats) {
      npc.stats = this.getDefaultStatsForRole(npc.role)
    }
    if (npc.level === undefined) {
      npc.level = 1
    }
    if (npc.xp === undefined) {
      npc.xp = 0
    }
    return npc
  }

  private getDefaultStatsForRole(role: string): NPCStats {
    // Default stats based on role
    const roleStats: Record<string, NPCStats> = {
      'Merchant': { str: 2, dex: 3, wis: 4, cha: 6, luck: 4 },
      'Warrior': { str: 6, dex: 4, wis: 2, cha: 3, luck: 3 },
      'Elder': { str: 2, dex: 2, wis: 7, cha: 5, luck: 3 },
      'Hunter': { str: 4, dex: 6, wis: 3, cha: 3, luck: 4 },
      'Farmer': { str: 3, dex: 3, wis: 5, cha: 3, luck: 3 },
      'Mystic': { str: 2, dex: 3, wis: 7, cha: 4, luck: 4 },
    }

    return roleStats[role] || { str: 3, dex: 3, wis: 3, cha: 3, luck: 3 }
  }

  getNPC(id: string): NPC | undefined {
    return this.npcs.get(id)
  }

  getAllNPCs(): NPC[] {
    return Array.from(this.npcs.values())
  }

  getNPCsByTribe(tribe: string): NPC[] {
    return Array.from(this.npcs.values()).filter(npc => npc.tribe === tribe)
  }

  calculateReaction(player: Player, npcId: string): {
    score: number
    level: "Hostile" | "Neutral" | "Friendly" | "Ally"
  } {
    const npc = this.npcs.get(npcId)
    if (!npc) {
      return { score: 0, level: "Neutral" }
    }

    const relationship = player.relationships[npcId] || 50
    const reactionScore = (player.stats.cha * 2) + relationship + (Math.random() * 20 - 10)

    let level: "Hostile" | "Neutral" | "Friendly" | "Ally"
    if (reactionScore < 20) {
      level = "Hostile"
    } else if (reactionScore < 50) {
      level = "Neutral"
    } else if (reactionScore < 80) {
      level = "Friendly"
    } else {
      level = "Ally"
    }

    return { score: reactionScore, level }
  }

  updateRelationship(npcId: string, change: number): void {
    const npc = this.npcs.get(npcId)
    if (npc) {
      npc.relationship = Math.max(0, Math.min(100, npc.relationship + change))
    }
  }

  setFlag(npcId: string, flag: string, value: boolean): void {
    const npc = this.npcs.get(npcId)
    if (npc) {
      npc.flags[flag] = value
    }
  }

  getFlag(npcId: string, flag: string): boolean {
    const npc = this.npcs.get(npcId)
    return npc?.flags[flag] || false
  }

  addNPC(npc: NPC): void {
    const npcWithDefaults = this.ensureNPCDefaults(npc)
    this.npcs.set(npcWithDefaults.id, npcWithDefaults)
  }

  /**
   * Add XP to an NPC and level them up if needed
   */
  addXP(npcId: string, amount: number): boolean {
    const npc = this.npcs.get(npcId)
    if (!npc) return false

    npc.xp += amount
    const levelUpThreshold = npc.level * 15 // NPCs need more XP per level

    if (npc.xp >= levelUpThreshold) {
      this.levelUpNPC(npcId)
      return true
    }
    return false
  }

  /**
   * Level up an NPC and improve their stats
   */
  private levelUpNPC(npcId: string): void {
    const npc = this.npcs.get(npcId)
    if (!npc) return

    npc.level += 1
    npc.xp = 0

    // Improve stats based on growth_path
    const statPoints = 2
    const growthPath = npc.growth_path.toLowerCase()

    // Determine which stats to improve based on growth path
    let preferredStats: (keyof NPCStats)[] = []
    if (growthPath.includes('trader') || growthPath.includes('merchant')) {
      preferredStats = ['cha', 'wis', 'luck']
    } else if (growthPath.includes('guard') || growthPath.includes('warrior') || growthPath.includes('soldier')) {
      preferredStats = ['str', 'dex', 'cha']
    } else if (growthPath.includes('council') || growthPath.includes('elder') || growthPath.includes('scholar')) {
      preferredStats = ['wis', 'cha', 'str']
    } else if (growthPath.includes('hunter') || growthPath.includes('scout')) {
      preferredStats = ['dex', 'str', 'luck']
    } else if (growthPath.includes('mystic') || growthPath.includes('mage')) {
      preferredStats = ['wis', 'cha', 'luck']
    } else {
      // Default: balanced growth
      preferredStats = ['str', 'dex', 'wis', 'cha', 'luck']
    }

    // Distribute stat points (70% chance for preferred stats, 30% for random)
    for (let i = 0; i < statPoints; i++) {
      if (Math.random() < 0.7 && preferredStats.length > 0) {
        const stat = preferredStats[Math.floor(Math.random() * preferredStats.length)]
        npc.stats[stat] += 1
      } else {
        const allStats: (keyof NPCStats)[] = ['str', 'dex', 'wis', 'cha', 'luck']
        const stat = allStats[Math.floor(Math.random() * allStats.length)]
        npc.stats[stat] += 1
      }
    }
  }

  /**
   * Trigger NPC growth based on time/events
   * Can be called daily or on specific events
   */
  processNPCGrowth(day: number, relationshipBonus: Record<string, number> = {}): string[] {
    const growthMessages: string[] = []

    this.npcs.forEach((npc, npcId) => {
      // NPCs grow based on:
      // 1. Time (every 5 days, small XP gain)
      // 2. Relationship with player (higher relationship = more growth)
      // 3. Random chance

      let xpGain = 0

      // Time-based growth (every 5 days)
      if (day % 5 === 0) {
        xpGain += 2
      }

      // Relationship-based growth
      const relationship = npc.relationship
      if (relationship >= 80) {
        xpGain += 3 // Strong allies grow faster
      } else if (relationship >= 60) {
        xpGain += 2 // Friends grow moderately
      } else if (relationship >= 40) {
        xpGain += 1 // Neutral relationships get minimal growth
      }

      // Random chance for growth (10% chance)
      if (Math.random() < 0.1) {
        xpGain += 1
      }

      // Apply relationship bonus if provided
      if (relationshipBonus[npcId]) {
        xpGain += Math.floor(relationshipBonus[npcId] / 10)
      }

      if (xpGain > 0) {
        const leveledUp = this.addXP(npcId, xpGain)
        if (leveledUp) {
          growthMessages.push(`${npc.name} has grown stronger! (Level ${npc.level})`)
        }
      }
    })

    return growthMessages
  }

  /**
   * Get NPC's current stats
   */
  getNPCStats(npcId: string): NPCStats | undefined {
    const npc = this.npcs.get(npcId)
    return npc?.stats
  }

  /**
   * Get NPC's level
   */
  getNPCLevel(npcId: string): number {
    const npc = this.npcs.get(npcId)
    return npc?.level || 1
  }

  /**
   * Improve a specific stat for an NPC (for special events)
   */
  improveNPCStat(npcId: string, stat: keyof NPCStats, amount: number = 1): void {
    const npc = this.npcs.get(npcId)
    if (npc && npc.stats) {
      npc.stats[stat] = Math.max(1, npc.stats[stat] + amount)
    }
  }
}

