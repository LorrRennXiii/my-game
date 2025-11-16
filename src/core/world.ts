import type { NPC } from '../types.js'

export interface WorldState {
  age: number // Days since world creation
  season: 'Spring' | 'Summer' | 'Autumn' | 'Winter'
  majorEvents: string[]
  worldResources: {
    stability: number // 0-100, affects random events
    prosperity: number // 0-100, affects trade and resources
    tension: number // 0-100, affects conflicts
  }
  lastMajorEvent: number // Day of last major event
  npcEncounters: Record<string, number> // Track when NPCs were last encountered
}

export class WorldManager {
  private worldState: WorldState

  constructor(initialState?: WorldState) {
    if (initialState) {
      this.worldState = initialState
    } else {
      this.worldState = this.createDefaultWorld()
    }
  }

  private createDefaultWorld(): WorldState {
    return {
      age: 0,
      season: 'Spring',
      majorEvents: [],
      worldResources: {
        stability: 70,
        prosperity: 50,
        tension: 30
      },
      lastMajorEvent: 0,
      npcEncounters: {}
    }
  }

  getWorldState(): WorldState {
    return { ...this.worldState }
  }

  /**
   * Advance the world by one day
   */
  advanceDay(day: number, seasonLength: number = 30, worldEventChance: number = 20, worldEventInterval: number = 10): {
    seasonChanged: boolean
    majorEvent?: string
    worldChanges: Record<string, number>
  } {
    this.worldState.age = day
    const oldSeason = this.worldState.season
    this.worldState.season = this.getSeasonForDay(day, seasonLength)
    const seasonChanged = oldSeason !== this.worldState.season

    const worldChanges: Record<string, number> = {}
    let majorEvent: string | undefined

    // Natural world progression
    if (Math.random() < 0.1) {
      // 10% chance of natural prosperity increase
      this.worldState.worldResources.prosperity = Math.min(100, 
        this.worldState.worldResources.prosperity + 1
      )
      worldChanges.prosperity = 1
    }

    // Check for major world events (configurable)
    if (day - this.worldState.lastMajorEvent >= worldEventInterval && Math.random() < (worldEventChance / 100)) {
      majorEvent = this.triggerMajorEvent(day)
      this.worldState.lastMajorEvent = day
    }

    // Seasonal effects
    if (seasonChanged) {
      const seasonalEffect = this.getSeasonalEffect(this.worldState.season)
      Object.entries(seasonalEffect).forEach(([key, value]) => {
        this.worldState.worldResources[key as keyof typeof this.worldState.worldResources] = 
          Math.max(0, Math.min(100, 
            this.worldState.worldResources[key as keyof typeof this.worldState.worldResources] + value
          ))
        worldChanges[key] = value
      })
    }

    return { seasonChanged, majorEvent, worldChanges }
  }

  private getSeasonForDay(day: number, seasonLength: number = 30): 'Spring' | 'Summer' | 'Autumn' | 'Winter' {
    const totalSeasonCycle = seasonLength * 4
    const seasonCycle = day % totalSeasonCycle
    if (seasonCycle < seasonLength) return 'Spring'
    if (seasonCycle < seasonLength * 2) return 'Summer'
    if (seasonCycle < seasonLength * 3) return 'Autumn'
    return 'Winter'
  }

  private getSeasonalEffect(season: 'Spring' | 'Summer' | 'Autumn' | 'Winter'): Record<string, number> {
    const effects: Record<string, Record<string, number>> = {
      'Spring': { prosperity: 2, stability: 1, tension: -1 },
      'Summer': { prosperity: 3, stability: 0, tension: 1 },
      'Autumn': { prosperity: 1, stability: -1, tension: 0 },
      'Winter': { prosperity: -2, stability: -2, tension: 2 }
    }
    return effects[season] || {}
  }

  private triggerMajorEvent(day: number): string {
    const events = [
      'A great harvest brings prosperity to all tribes',
      'A mysterious trader arrives with rare goods',
      'Ancient ruins are discovered in the valley',
      'A festival brings joy and unity',
      'A storm damages crops across the region',
      'A new trade route opens between tribes',
      'A wise elder shares ancient knowledge',
      'Wild beasts become more active',
      'A rare resource is found',
      'Diplomatic tensions rise between tribes'
    ]

    const event = events[Math.floor(Math.random() * events.length)]
    this.worldState.majorEvents.push(`${day}: ${event}`)

    // Update world resources based on event
    if (event.includes('prosperity') || event.includes('harvest') || event.includes('trade')) {
      this.worldState.worldResources.prosperity = Math.min(100, 
        this.worldState.worldResources.prosperity + 5
      )
    }
    if (event.includes('tension') || event.includes('beasts') || event.includes('storm')) {
      this.worldState.worldResources.tension = Math.min(100, 
        this.worldState.worldResources.tension + 5
      )
    }
    if (event.includes('unity') || event.includes('knowledge') || event.includes('festival')) {
      this.worldState.worldResources.stability = Math.min(100, 
        this.worldState.worldResources.stability + 5
      )
    }

    return event
  }

  /**
   * Record an NPC encounter
   */
  recordNPCEncounter(npcId: string, day: number): void {
    this.worldState.npcEncounters[npcId] = day
  }

  /**
   * Get days since last encounter with NPC
   */
  getDaysSinceEncounter(npcId: string, currentDay: number): number {
    const lastEncounter = this.worldState.npcEncounters[npcId]
    if (!lastEncounter) return Infinity
    return currentDay - lastEncounter
  }

  /**
   * Check if NPC has new developments since last encounter
   */
  hasNPCDevelopments(npcId: string, currentDay: number, npcLevel: number, lastEncounterLevel: number): boolean {
    const daysSince = this.getDaysSinceEncounter(npcId, currentDay)
    return daysSince >= 5 || npcLevel > lastEncounterLevel
  }

  /**
   * Get world state effects on actions
   */
  getActionModifiers(): {
    prosperityBonus: number
    stabilityBonus: number
    tensionPenalty: number
  } {
    return {
      prosperityBonus: Math.floor(this.worldState.worldResources.prosperity / 20),
      stabilityBonus: Math.floor(this.worldState.worldResources.stability / 25),
      tensionPenalty: Math.floor(this.worldState.worldResources.tension / 30)
    }
  }
}

