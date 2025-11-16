import type { Item, ItemType, ItemRarity, LootTable, ItemStats } from '../types.js';

/**
 * Item Manager - Handles item creation, loot generation, and item management
 */
export class ItemManager {
  /**
   * Generate a random item based on action type and player level
   */
  generateLoot(actionType: string, playerLevel: number, luck: number = 0): Item[] {
    const lootTable = this.getLootTableForAction(actionType, playerLevel);
    const lootedItems: Item[] = [];

    for (const lootEntry of lootTable.items) {
      // Adjust chance based on luck stat (luck increases drop chance)
      const luckBonus = (luck / 100) * 10; // Max 10% bonus from luck
      const adjustedChance = Math.min(100, lootEntry.chance + luckBonus);
      
      if (Math.random() * 100 < adjustedChance) {
        const quantity = lootEntry.minQuantity && lootEntry.maxQuantity
          ? Math.floor(Math.random() * (lootEntry.maxQuantity - lootEntry.minQuantity + 1)) + lootEntry.minQuantity
          : 1;

        const item = { ...lootEntry.item };
        
        if (item.stackable) {
          item.quantity = quantity;
        }

        // Check if item already exists in loot (for stackable items)
        const existingItem = lootedItems.find(i => i.id === item.id && i.stackable);
        if (existingItem && existingItem.stackable) {
          existingItem.quantity = (existingItem.quantity || 1) + quantity;
        } else {
          lootedItems.push(item);
        }
      }
    }

    return lootedItems;
  }

  /**
   * Get loot table for a specific action type
   */
  private getLootTableForAction(actionType: string, playerLevel: number): LootTable {
    switch (actionType) {
      case 'farm':
        return this.getFarmingLootTable(playerLevel);
      case 'gather':
        return this.getGatheringLootTable(playerLevel);
      case 'hunt':
        return this.getHuntingLootTable(playerLevel);
      case 'explore':
        return this.getExploringLootTable(playerLevel);
      case 'trade':
        return this.getTradingLootTable(playerLevel);
      default:
        return { items: [] };
    }
  }

  /**
   * Farming loot table - food items, seeds, farming tools
   */
  private getFarmingLootTable(playerLevel: number): LootTable {
    return {
      items: [
        {
          item: this.createItem('wheat', 'consumable', 'common', '🌾 Wheat', 'Fresh wheat from the fields', {}, 1, { health: 2 }),
          chance: 60,
          minQuantity: 1,
          maxQuantity: 3
        },
        {
          item: this.createItem('corn', 'consumable', 'common', '🌽 Corn', 'Golden corn cobs', {}, 1, { health: 3 }),
          chance: 40,
          minQuantity: 1,
          maxQuantity: 2
        },
        {
          item: this.createItem('potato', 'consumable', 'common', '🥔 Potato', 'Sturdy potatoes', {}, 1, { health: 2 }),
          chance: 50,
          minQuantity: 1,
          maxQuantity: 4
        },
        {
          item: this.createItem('seed_pack', 'material', 'uncommon', '🌱 Seed Pack', 'A pack of various seeds', {}),
          chance: 15,
          minQuantity: 1,
          maxQuantity: 1
        },
        {
          item: this.createItem('farming_hoe', 'weapon', 'uncommon', '⛏️ Farming Hoe', 'A sturdy hoe that increases farming efficiency', { str: 1, wis: 1 }, playerLevel),
          chance: 5,
          minQuantity: 1,
          maxQuantity: 1
        }
      ]
    };
  }

  /**
   * Gathering loot table - herbs, materials, nature items
   */
  private getGatheringLootTable(playerLevel: number): LootTable {
    return {
      items: [
        {
          item: this.createItem('herb_common', 'consumable', 'common', '🌿 Common Herb', 'A healing herb', { health: 5 }),
          chance: 70,
          minQuantity: 1,
          maxQuantity: 3
        },
        {
          item: this.createItem('herb_rare', 'consumable', 'uncommon', '🍃 Rare Herb', 'A rare healing herb', { health: 15, stamina: 5 }),
          chance: 20,
          minQuantity: 1,
          maxQuantity: 2
        },
        {
          item: this.createItem('mushroom', 'consumable', 'common', '🍄 Mushroom', 'A wild mushroom', { health: 3 }),
          chance: 45,
          minQuantity: 1,
          maxQuantity: 4
        },
        {
          item: this.createItem('berries', 'consumable', 'common', '🫐 Berries', 'Wild berries', { health: 2, stamina: 1 }),
          chance: 55,
          minQuantity: 1,
          maxQuantity: 5
        },
        {
          item: this.createItem('bark', 'material', 'common', '🪵 Bark', 'Tree bark for crafting', {}),
          chance: 30,
          minQuantity: 1,
          maxQuantity: 3
        },
        {
          item: this.createItem('gathering_bag', 'accessory', 'uncommon', '🎒 Gathering Bag', 'Increases gathering efficiency', { dex: 1, wis: 1 }, playerLevel),
          chance: 8,
          minQuantity: 1,
          maxQuantity: 1
        }
      ]
    };
  }

  /**
   * Hunting loot table - meat, hides, weapons
   */
  private getHuntingLootTable(playerLevel: number): LootTable {
    return {
      items: [
        {
          item: this.createItem('raw_meat', 'consumable', 'common', '🥩 Raw Meat', 'Fresh meat from the hunt', {}, 1, { health: 5 }),
          chance: 80,
          minQuantity: 1,
          maxQuantity: 3
        },
        {
          item: this.createItem('hide', 'material', 'common', '🦌 Hide', 'Animal hide for crafting', {}),
          chance: 50,
          minQuantity: 1,
          maxQuantity: 2
        },
        {
          item: this.createItem('bone', 'material', 'common', '🦴 Bone', 'Animal bone for crafting', {}),
          chance: 35,
          minQuantity: 1,
          maxQuantity: 2
        },
        {
          item: this.createItem('hunting_bow', 'weapon', 'rare', '🏹 Hunting Bow', 'A well-crafted hunting bow', { dex: 3, str: 2, damage: 5 }, playerLevel),
          chance: 3,
          minQuantity: 1,
          maxQuantity: 1
        },
        {
          item: this.createItem('hunter_cloak', 'armor', 'uncommon', '🧥 Hunter Cloak', 'A cloak that aids in hunting', { dex: 2, defense: 3 }, playerLevel),
          chance: 5,
          minQuantity: 1,
          maxQuantity: 1
        }
      ]
    };
  }

  /**
   * Exploring loot table - random finds, treasures, equipment
   */
  private getExploringLootTable(playerLevel: number): LootTable {
    return {
      items: [
        {
          item: this.createItem('ancient_coin', 'misc', 'uncommon', '🪙 Ancient Coin', 'A coin from ages past', {}),
          chance: 25,
          minQuantity: 1,
          maxQuantity: 3
        },
        {
          item: this.createItem('gem', 'misc', 'rare', '💎 Gem', 'A precious gem', {}),
          chance: 10,
          minQuantity: 1,
          maxQuantity: 1
        },
        {
          item: this.createItem('explorer_boots', 'armor', 'uncommon', '👢 Explorer Boots', 'Boots that aid in exploration', { dex: 2, stamina: 2 }, playerLevel),
          chance: 8,
          minQuantity: 1,
          maxQuantity: 1
        },
        {
          item: this.createItem('lucky_charm', 'accessory', 'rare', '🍀 Lucky Charm', 'Increases luck', { luck: 5 }, playerLevel),
          chance: 5,
          minQuantity: 1,
          maxQuantity: 1
        },
        {
          item: this.createItem('adventurer_sword', 'weapon', 'rare', '⚔️ Adventurer Sword', 'A sword found in the wilds', { str: 4, dex: 2, damage: 8 }, playerLevel),
          chance: 2,
          minQuantity: 1,
          maxQuantity: 1
        }
      ]
    };
  }

  /**
   * Trading loot table - trade goods, wealth items
   */
  private getTradingLootTable(playerLevel: number): LootTable {
    return {
      items: [
        {
          item: this.createItem('trade_goods', 'misc', 'common', '📦 Trade Goods', 'Valuable trade goods', {}),
          chance: 40,
          minQuantity: 1,
          maxQuantity: 2
        },
        {
          item: this.createItem('merchant_ring', 'accessory', 'uncommon', '💍 Merchant Ring', 'Increases trading efficiency', { cha: 2, wis: 1 }, playerLevel),
          chance: 8,
          minQuantity: 1,
          maxQuantity: 1
        }
      ]
    };
  }

  /**
   * Create an item with specified properties
   */
  private createItem(
    id: string,
    type: ItemType,
    rarity: ItemRarity,
    name: string,
    description: string,
    stats: Partial<ItemStats> = {},
    level?: number,
    consumableEffect?: { health?: number; stamina?: number }
  ): Item {
    const item: Item = {
      id,
      name,
      type,
      rarity,
      description,
      icon: name.split(' ')[0], // Extract emoji from name
      stackable: type === 'consumable' || type === 'material',
      maxStack: type === 'consumable' || type === 'material' ? 99 : 1,
      quantity: 1,
      level: level || 1,
      sellValue: this.calculateSellValue(rarity, stats),
    };

    if (stats) {
      item.stats = {
        str: stats.str || 0,
        dex: stats.dex || 0,
        wis: stats.wis || 0,
        cha: stats.cha || 0,
        luck: stats.luck || 0,
        health: stats.health || 0,
        maxHealth: stats.maxHealth || 0,
        stamina: stats.stamina || 0,
        maxStamina: stats.maxStamina || 0,
        damage: stats.damage || 0,
        defense: stats.defense || 0,
      };
    }

    // Add consumable effects for consumable items
    if (type === 'consumable' && consumableEffect) {
      item.consumableEffect = {
        health: consumableEffect.health || 0,
        stamina: consumableEffect.stamina || 0,
      };
    }

    return item;
  }

  /**
   * Calculate sell value based on rarity and stats
   */
  private calculateSellValue(rarity: ItemRarity, stats: Partial<ItemStats>): number {
    const baseValues: Record<ItemRarity, number> = {
      common: 5,
      uncommon: 15,
      rare: 50,
      epic: 150,
      legendary: 500,
    };

    let value = baseValues[rarity] || 5;

    // Add value based on stats
    if (stats) {
      const statValue = (stats.str || 0) + (stats.dex || 0) + (stats.wis || 0) + 
                       (stats.cha || 0) + (stats.luck || 0) + 
                       (stats.damage || 0) * 2 + (stats.defense || 0) * 2;
      value += statValue * 2;
    }

    return Math.floor(value);
  }

  /**
   * Get rarity color (for UI)
   */
  getRarityColor(rarity: ItemRarity): string {
    const colors: Record<ItemRarity, string> = {
      common: '#9ca3af', // Gray
      uncommon: '#10b981', // Green
      rare: '#3b82f6', // Blue
      epic: '#a855f7', // Purple
      legendary: '#f59e0b', // Orange/Gold
    };
    return colors[rarity] || colors.common;
  }
}

