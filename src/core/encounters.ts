import type { NPC, Player, NPCStats } from '../types.js'
import type { WorldState } from './world.js'

export interface EncounterEvent {
  id: string
  type: 'quest' | 'trade' | 'training' | 'story' | 'challenge'
  title: string
  description: string
  requirements?: {
    relationship?: number
    npcLevel?: number
    playerLevel?: number
    stats?: Partial<Record<keyof NPCStats, number>>
  }
  rewards?: {
    xp?: number
    statBonus?: Partial<Record<keyof Player['stats'], number>>
    skillBonus?: Partial<Record<keyof Player['skills'], number>>
    items?: Record<string, number>
    food?: number
    materials?: number
    wealth?: number
    spirit_energy?: number
    relationship?: number
  }
  effects?: {
    worldProsperity?: number
    worldStability?: number
    worldTension?: number
  }
}

export class EncounterManager {
  private encounterEvents: Map<string, EncounterEvent[]>

  constructor() {
    this.encounterEvents = new Map()
    this.initializeEncounters()
  }

  private initializeEncounters(): void {
    // Merchant encounters
    this.encounterEvents.set('Merchant', [
      {
        id: 'merchant_rare_trade',
        type: 'trade',
        title: 'Rare Goods Opportunity',
        description: 'The merchant has acquired rare materials from distant lands.',
        requirements: { relationship: 50 },
        rewards: {
          xp: 5,
          wealth: 50,
          materials: 10,
          relationship: 5
        }
      },
      {
        id: 'merchant_investment',
        type: 'trade',
        title: 'Investment Opportunity',
        description: 'The merchant offers you a chance to invest in a trade venture.',
        requirements: { relationship: 70, playerLevel: 3 },
        rewards: {
          xp: 10,
          wealth: 100,
          relationship: 10
        },
        effects: {
          worldProsperity: 2
        }
      }
    ])

    // Warrior encounters
    this.encounterEvents.set('Warrior', [
      {
        id: 'warrior_training',
        type: 'training',
        title: 'Combat Training',
        description: 'The warrior offers to train you in combat techniques.',
        requirements: { relationship: 40, npcLevel: 2 },
        rewards: {
          xp: 10,
          statBonus: { str: 1 },
          relationship: 5
        }
      },
      {
        id: 'warrior_quest',
        type: 'quest',
        title: 'Hunting Quest',
        description: 'The warrior needs help tracking a dangerous beast.',
        requirements: { relationship: 60, playerLevel: 2 },
        rewards: {
          xp: 20,
          statBonus: { dex: 1 },
          items: { food: 15, materials: 8 },
          relationship: 10
        }
      }
    ])

    // Elder encounters
    this.encounterEvents.set('Elder', [
      {
        id: 'elder_wisdom',
        type: 'story',
        title: 'Ancient Wisdom',
        description: 'The elder shares knowledge of the tribe\'s history and secrets.',
        requirements: { relationship: 50 },
        rewards: {
          xp: 15,
          statBonus: { wis: 1 },
          skillBonus: { social: 1 },
          relationship: 8
        },
        effects: {
          worldStability: 3
        }
      },
      {
        id: 'elder_council',
        type: 'quest',
        title: 'Council Mission',
        description: 'The elder assigns you an important diplomatic mission.',
        requirements: { relationship: 70, playerLevel: 4 },
        rewards: {
          xp: 30,
          statBonus: { cha: 2 },
          relationship: 15
        },
        effects: {
          worldStability: 5,
          worldTension: -3
        }
      }
    ])
  }

  /**
   * Check for available encounters with an NPC
   */
  getAvailableEncounters(
    npc: NPC,
    player: Player,
    worldState: WorldState,
    daysSinceLastEncounter: number
  ): EncounterEvent[] {
    const roleEncounters = this.encounterEvents.get(npc.role) || []
    const available: EncounterEvent[] = []

    for (const encounter of roleEncounters) {
      if (this.checkEncounterRequirements(encounter, npc, player, worldState, daysSinceLastEncounter)) {
        available.push(encounter)
      }
    }

    // Add dynamic encounters based on NPC level and relationship
    const relationship = player.relationships[npc.id] || 50;
    if ((npc.level || 1) >= 3 && relationship >= 60) {
      available.push(this.generateDynamicEncounter(npc, player))
    }

    return available
  }

  private checkEncounterRequirements(
    encounter: EncounterEvent,
    npc: NPC,
    player: Player,
    worldState: WorldState,
    daysSinceLastEncounter: number
  ): boolean {
    const req = encounter.requirements
    if (!req) return true

    const relationship = player.relationships[npc.id] || 50;

    if (req.relationship !== undefined) {
      if (relationship < req.relationship) {
        return false;
      }
    }

    if (req.npcLevel !== undefined && (npc.level || 1) < req.npcLevel) {
      return false
    }

    if (req.playerLevel !== undefined && player.level < req.playerLevel) {
      return false
    }

    if (req.stats && npc.stats) {
      for (const [stat, minValue] of Object.entries(req.stats)) {
        if ((npc.stats[stat as keyof NPCStats] || 0) < minValue) {
          return false
        }
      }
    }

    // Higher chance if NPC has grown since last encounter
    if (daysSinceLastEncounter >= 5) {
      return true // More likely to have new encounters
    }

    // Random chance based on relationship
    const encounterChance = 0.3 + (relationship / 200)
    return Math.random() < encounterChance
  }

  private generateDynamicEncounter(npc: NPC, player: Player): EncounterEvent {
    const encounterTypes = ['quest', 'training', 'story']
    const type = encounterTypes[Math.floor(Math.random() * encounterTypes.length)] as EncounterEvent['type']

    const titles: Record<string, string[]> = {
      quest: ['A Favor', 'Special Mission', 'Important Task'],
      training: ['Skill Training', 'Advanced Techniques', 'Master Class'],
      story: ['Tales of Old', 'Secret Knowledge', 'Hidden History']
    }

    const descriptions: Record<string, string[]> = {
      quest: [
        `${npc.name} needs your help with an important matter.`,
        `${npc.name} has a task that requires your skills.`,
        `${npc.name} trusts you with a special mission.`
      ],
      training: [
        `${npc.name} offers to share advanced techniques.`,
        `${npc.name} wants to train you in new skills.`,
        `${npc.name} sees potential and offers guidance.`
      ],
      story: [
        `${npc.name} shares fascinating stories from the past.`,
        `${npc.name} reveals secrets about the tribe.`,
        `${npc.name} tells you about important events.`
      ]
    }

    const title = titles[type][Math.floor(Math.random() * titles[type].length)]
    const description = descriptions[type][Math.floor(Math.random() * descriptions[type].length)]

    // Generate rewards based on NPC level and relationship
    const relationship = player.relationships[npc.id] || 50;
    const baseXP = (npc.level || 1) * 5 + Math.floor(relationship / 10)
    const statBonus: Partial<Record<keyof Player['stats'], number>> = {}
    const statToBoost = ['str', 'dex', 'wis', 'cha'][Math.floor(Math.random() * 4)] as keyof Player['stats']
    statBonus[statToBoost] = 1

    return {
      id: `dynamic_${npc.id}_${Date.now()}`,
      type,
      title,
      description,
      rewards: {
        xp: baseXP,
        statBonus,
        relationship: Math.floor(relationship / 10) + 5
      }
    }
  }

  /**
   * Execute an encounter event
   */
  executeEncounter(
    encounter: EncounterEvent,
    npc: NPC,
    player: Player
  ): {
    success: boolean
    message: string
    rewards: EncounterEvent['rewards']
    effects: EncounterEvent['effects']
  } {
    return {
      success: true,
      message: `${encounter.title}: ${encounter.description}`,
      rewards: encounter.rewards,
      effects: encounter.effects
    }
  }
}

