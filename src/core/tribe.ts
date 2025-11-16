import type { Tribe, TribeAttributes, TribeResources } from '../types.js';

export class TribeManager {
  private tribe: Tribe;

  constructor(tribe?: Tribe) {
    if (tribe) {
      this.tribe = tribe;
    } else {
      this.tribe = this.createDefaultTribe();
    }
  }

  private createDefaultTribe(): Tribe {
    return {
      name: "Stonefang",
      attributes: {
        prosperity: 30,
        defense: 20,
        knowledge: 10,
        spirit: 5,
        morale: 60
      },
      resources: {
        food: 120,
        materials: 70,
        wealth: 50,
        spirit_energy: 20
      }
    };
  }

  getTribe(): Tribe {
    return { ...this.tribe };
  }

  updateResources(updates: Partial<TribeResources>): void {
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        const resourceKey = key as keyof TribeResources;
        const currentValue = this.tribe.resources[resourceKey];
        if (currentValue !== undefined) {
          this.tribe.resources[resourceKey] = Math.max(0, currentValue + value);
        }
      }
    });
  }

  updateAttributes(updates: Partial<TribeAttributes>): void {
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        this.tribe.attributes[key as keyof TribeAttributes] = 
          Math.max(0, Math.min(100, this.tribe.attributes[key as keyof TribeAttributes] + value));
      }
    });
  }

  calculateProsperity(): void {
    // prosperity = (food + wealth) / 100
    const prosperity = Math.floor((this.tribe.resources.food + this.tribe.resources.wealth) / 100);
    this.tribe.attributes.prosperity = Math.min(100, prosperity);
  }

  updateMorale(change: number): void {
    this.tribe.attributes.morale = Math.max(0, Math.min(100, 
      this.tribe.attributes.morale + change
    ));
  }

  getResource(resource: keyof TribeResources): number {
    return this.tribe.resources[resource] || 0;
  }

  getAttribute(attribute: keyof TribeAttributes): number {
    return this.tribe.attributes[attribute];
  }

  getStaminaRegenBonus(): number {
    // Morale influences stamina regen
    if (this.tribe.attributes.morale >= 80) return 1;
    if (this.tribe.attributes.morale >= 60) return 0;
    if (this.tribe.attributes.morale >= 40) return -1;
    return -2;
  }
}

