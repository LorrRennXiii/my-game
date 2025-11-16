import type { Player, PlayerStats, PlayerSkills, PlayerInventory, Item, EquipmentSlots } from '../types.js';

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
      flags: {},
      restDaysRemaining: 0,
      bag: [],
      equipment: {
        weapon: null,
        armor: null,
        accessory1: null,
        accessory2: null,
        accessory3: null
      }
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
    
    // If health reaches 0 or below, enter resting state
    if (this.player.health <= 0) {
      this.player.restDaysRemaining = 3;
      this.player.health = 0; // Ensure it's exactly 0, not negative
    }
  }
  
  isResting(): boolean {
    return (this.player.restDaysRemaining || 0) > 0;
  }
  
  getRestDaysRemaining(): number {
    return this.player.restDaysRemaining || 0;
  }
  
  processRestDay(): void {
    if (this.player.restDaysRemaining && this.player.restDaysRemaining > 0) {
      this.player.restDaysRemaining -= 1;
      
      // Restore health gradually during rest (33% per day)
      if (this.player.restDaysRemaining > 0) {
        const healAmount = Math.floor(this.player.maxHealth / 3);
        this.player.health = Math.min(this.player.maxHealth, this.player.health + healAmount);
      } else {
        // Rest complete - fully restore health
        this.player.health = this.player.maxHealth;
      }
    }
  }

  heal(amount: number): void {
    this.player.health = Math.min(this.player.maxHealth, this.player.health + amount);
  }

  restoreHealth(): void {
    this.player.health = this.player.maxHealth;
  }

  // Bag/Inventory Management
  addItemToBag(item: Item): boolean {
    if (!this.player.bag) {
      this.player.bag = [];
    }

    // Check if item is stackable and already exists
    if (item.stackable) {
      const existingItem = this.player.bag.find(i => i.id === item.id);
      if (existingItem && existingItem.stackable) {
        const currentQuantity = existingItem.quantity || 1;
        const newQuantity = (item.quantity || 1) + currentQuantity;
        const maxStack = existingItem.maxStack || 99;
        
        if (newQuantity <= maxStack) {
          existingItem.quantity = newQuantity;
          return true;
        } else {
          // Partial stack
          existingItem.quantity = maxStack;
          item.quantity = newQuantity - maxStack;
          // Continue to add remaining as new item
        }
      }
    }

    // Check bag capacity (50 slots like Diablo)
    const maxBagSlots = 50;
    if (this.player.bag.length >= maxBagSlots) {
      return false; // Bag is full
    }

    this.player.bag.push(item);
    return true;
  }

  removeItemFromBag(itemId: string, quantity: number = 1): boolean {
    if (!this.player.bag) return false;

    const itemIndex = this.player.bag.findIndex(i => i.id === itemId);
    if (itemIndex === -1) return false;

    const item = this.player.bag[itemIndex];
    
    if (item.stackable && item.quantity) {
      if (item.quantity > quantity) {
        item.quantity -= quantity;
        return true;
      } else if (item.quantity === quantity) {
        this.player.bag.splice(itemIndex, 1);
        return true;
      }
    } else {
      this.player.bag.splice(itemIndex, 1);
      return true;
    }

    return false;
  }

  getBag(): Item[] {
    return this.player.bag || [];
  }

  // Equipment Management
  equipItem(item: Item, slot: keyof EquipmentSlots): { success: boolean; message: string; unequipped?: Item } {
    if (!this.player.equipment) {
      this.player.equipment = {
        weapon: null,
        armor: null,
        accessory1: null,
        accessory2: null,
        accessory3: null
      };
    }

    // Validate item type matches slot
    if (!this.canEquipInSlot(item, slot)) {
      return { success: false, message: `Cannot equip ${item.name} in ${slot} slot.` };
    }

    // Check level requirement
    if (item.level && item.level > this.player.level) {
      return { success: false, message: `Requires level ${item.level} to equip.` };
    }

    // Remove item from bag
    if (!this.removeItemFromBag(item.id, 1)) {
      return { success: false, message: 'Item not found in bag.' };
    }

    // Unequip existing item if any
    const unequipped = this.player.equipment[slot];
    if (unequipped) {
      // Add unequipped item back to bag
      this.addItemToBag(unequipped);
    }

    // Equip new item
    this.player.equipment[slot] = item;

    // Apply equipment stats
    this.applyEquipmentStats();

    return { 
      success: true, 
      message: `Equipped ${item.name}.`,
      unequipped: unequipped || undefined
    };
  }

  unequipItem(slot: keyof EquipmentSlots): { success: boolean; message: string } {
    if (!this.player.equipment) {
      return { success: false, message: 'No equipment system initialized.' };
    }

    const item = this.player.equipment[slot];
    if (!item) {
      return { success: false, message: `No item equipped in ${slot} slot.` };
    }

    // Remove from equipment
    this.player.equipment[slot] = null;

    // Add back to bag
    if (!this.addItemToBag(item)) {
      // If bag is full, put it back
      this.player.equipment[slot] = item;
      return { success: false, message: 'Bag is full. Cannot unequip item.' };
    }

    // Recalculate stats
    this.applyEquipmentStats();

    return { success: true, message: `Unequipped ${item.name}.` };
  }

  private canEquipInSlot(item: Item, slot: keyof EquipmentSlots): boolean {
    switch (slot) {
      case 'weapon':
        return item.type === 'weapon';
      case 'armor':
        return item.type === 'armor';
      case 'accessory1':
      case 'accessory2':
      case 'accessory3':
        return item.type === 'accessory';
      default:
        return false;
    }
  }

  private applyEquipmentStats(): void {
    if (!this.player.equipment) return;
    // Equipment stats are applied when calculating effective stats
    // This method is a placeholder for future stat recalculation logic
  }

  getEquipment(): EquipmentSlots {
    return this.player.equipment || {
      weapon: null,
      armor: null,
      accessory1: null,
      accessory2: null,
      accessory3: null
    };
  }

  getEffectiveStats(): PlayerStats {
    const baseStats = { ...this.player.stats };
    
    // Apply equipment bonuses
    if (this.player.equipment) {
      Object.values(this.player.equipment).forEach(item => {
        if (item && item.stats) {
          baseStats.str += item.stats.str || 0;
          baseStats.dex += item.stats.dex || 0;
          baseStats.wis += item.stats.wis || 0;
          baseStats.cha += item.stats.cha || 0;
          baseStats.luck += item.stats.luck || 0;
        }
      });
    }

    return baseStats;
  }

  // Consume item
  consumeItem(itemId: string): { success: boolean; message: string } {
    if (!this.player.bag) return { success: false, message: 'Bag not initialized.' };

    const item = this.player.bag.find(i => i.id === itemId);
    if (!item) {
      return { success: false, message: 'Item not found in bag.' };
    }

    if (item.type !== 'consumable') {
      return { success: false, message: 'Item is not consumable.' };
    }

    if (!item.consumableEffect) {
      return { success: false, message: 'Item has no consumable effect.' };
    }

    // Apply effects
    if (item.consumableEffect.health) {
      this.heal(item.consumableEffect.health);
    }
    if (item.consumableEffect.stamina) {
      this.player.stamina = Math.min(this.player.maxStamina, this.player.stamina + item.consumableEffect.stamina);
    }

    // Remove item
    this.removeItemFromBag(itemId, 1);

    return { success: true, message: `Consumed ${item.name}.` };
  }
}

