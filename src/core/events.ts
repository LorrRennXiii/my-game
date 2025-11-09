import type { Event, Tribe, Player } from '../types.js';

export class EventManager {
  private events: Map<string, Event>;
  private triggeredEvents: Set<string>;

  constructor(events: Event[] = []) {
    this.events = new Map();
    this.triggeredEvents = new Set();
    events.forEach(event => this.events.set(event.id, event));
  }

  addEvent(event: Event): void {
    this.events.set(event.id, event);
  }

  checkDailyEvent(): Event | null {
    // 10% chance of daily event
    if (Math.random() < 0.1) {
      const dailyEvents = Array.from(this.events.values())
        .filter(e => e.type === "daily" && !this.triggeredEvents.has(e.id));
      
      if (dailyEvents.length > 0) {
        const event = dailyEvents[Math.floor(Math.random() * dailyEvents.length)];
        this.triggeredEvents.add(event.id);
        return event;
      }
    }
    return null;
  }

  checkActionEvent(actionType: string): Event | null {
    const actionEvents = Array.from(this.events.values())
      .filter(e => e.type === "action" && e.condition?.includes(actionType));
    
    if (actionEvents.length > 0 && Math.random() < 0.15) {
      const event = actionEvents[Math.floor(Math.random() * actionEvents.length)];
      return event;
    }
    return null;
  }

  checkNPCEvent(npcId: string, relationship: number): Event | null {
    if (relationship >= 70 && Math.random() < 0.2) {
      const npcEvents = Array.from(this.events.values())
        .filter(e => e.type === "npc" && e.condition?.includes(npcId));
      
      if (npcEvents.length > 0) {
        return npcEvents[Math.floor(Math.random() * npcEvents.length)];
      }
    }
    return null;
  }

  checkTribeMilestone(tribe: Tribe): Event | null {
    const milestoneEvents = Array.from(this.events.values())
      .filter(e => e.type === "tribe_milestone" && !this.triggeredEvents.has(e.id));
    
    for (const event of milestoneEvents) {
      if (this.evaluateCondition(event.condition || "", tribe)) {
        this.triggeredEvents.add(event.id);
        return event;
      }
    }
    return null;
  }

  private evaluateCondition(condition: string, tribe: Tribe): boolean {
    // Simple condition evaluation
    // Format: "tribe.food > 100" or "tribe.prosperity >= 50"
    if (!condition) return true;

    const parts = condition.split(/\s*(>=|<=|>|<|==)\s*/);
    if (parts.length !== 3) return false;

    const [resourcePath, operator, valueStr] = parts;
    const value = parseInt(valueStr, 10);

    const [obj, prop] = resourcePath.split('.');
    if (obj !== 'tribe') return false;

    let actualValue: number;
    if (prop in tribe.resources) {
      actualValue = tribe.resources[prop as keyof typeof tribe.resources];
    } else if (prop in tribe.attributes) {
      actualValue = tribe.attributes[prop as keyof typeof tribe.attributes];
    } else {
      return false;
    }

    switch (operator) {
      case '>': return actualValue > value;
      case '>=': return actualValue >= value;
      case '<': return actualValue < value;
      case '<=': return actualValue <= value;
      case '==': return actualValue === value;
      default: return false;
    }
  }

  applyEventEffects(event: Event, tribe: any, player?: Player): void {
    // Apply effects to tribe
    if (event.effects.food !== undefined) {
      tribe.updateResources({ food: event.effects.food });
    }
    if (event.effects.materials !== undefined) {
      tribe.updateResources({ materials: event.effects.materials });
    }
    if (event.effects.wealth !== undefined) {
      tribe.updateResources({ wealth: event.effects.wealth });
    }
    if (event.effects.spirit_energy !== undefined) {
      tribe.updateResources({ spirit_energy: event.effects.spirit_energy });
    }
    if (event.effects.morale !== undefined) {
      tribe.updateMorale(event.effects.morale);
    }
    if (event.effects.prosperity !== undefined) {
      tribe.updateAttributes({ prosperity: event.effects.prosperity });
    }
    if (event.effects.defense !== undefined) {
      tribe.updateAttributes({ defense: event.effects.defense });
    }
    if (event.effects.knowledge !== undefined) {
      tribe.updateAttributes({ knowledge: event.effects.knowledge });
    }
    if (event.effects.spirit !== undefined) {
      tribe.updateAttributes({ spirit: event.effects.spirit });
    }
  }

  resetDailyEvents(): void {
    // Reset daily events for new day (keep milestone events triggered)
    const dailyEventIds = Array.from(this.events.values())
      .filter(e => e.type === "daily")
      .map(e => e.id);
    
    dailyEventIds.forEach(id => this.triggeredEvents.delete(id));
  }
}

