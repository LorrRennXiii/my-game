import type { Player, WildAnimal, CombatResult } from '../types.js';

export class CombatManager {
  /**
   * Generate a random wild animal encounter based on player level
   */
  generateWildAnimal(playerLevel: number): WildAnimal {
    const animals = [
      { name: 'Wild Boar', baseLevel: 1, str: 4, dex: 2, health: 15, damage: 3 },
      { name: 'Dire Wolf', baseLevel: 2, str: 5, dex: 4, health: 20, damage: 4 },
      { name: 'Mountain Bear', baseLevel: 3, str: 7, dex: 2, health: 30, damage: 6 },
      { name: 'Shadow Panther', baseLevel: 4, str: 6, dex: 8, health: 25, damage: 5 },
      { name: 'Ancient Stag', baseLevel: 5, str: 8, dex: 6, health: 40, damage: 7 },
    ];

    // Select animal based on player level (higher level = stronger animals more likely)
    const availableAnimals = animals.filter(a => a.baseLevel <= playerLevel + 2);
    const selectedAnimal = availableAnimals[Math.floor(Math.random() * availableAnimals.length)] || animals[0];

    // Scale animal level and stats based on player level
    const levelVariation = Math.floor(Math.random() * 3) - 1; // -1 to +1
    const animalLevel = Math.max(1, selectedAnimal.baseLevel + levelVariation);
    const levelMultiplier = 1 + (animalLevel - 1) * 0.2;

    return {
      id: `animal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: selectedAnimal.name,
      level: animalLevel,
      stats: {
        str: Math.floor(selectedAnimal.str * levelMultiplier),
        dex: Math.floor(selectedAnimal.dex * levelMultiplier),
        health: Math.floor(selectedAnimal.health * levelMultiplier),
        maxHealth: Math.floor(selectedAnimal.health * levelMultiplier),
      },
      rewards: {
        xp: Math.floor(5 * animalLevel),
        food: Math.floor(3 * animalLevel),
        materials: Math.floor(2 * animalLevel),
        wealth: Math.floor(animalLevel * 2),
      },
      damage: Math.floor(selectedAnimal.damage * levelMultiplier),
    };
  }

  /**
   * Calculate combat outcome
   */
  calculateCombat(player: Player, animal: WildAnimal): CombatResult {
    const playerAttack = this.calculatePlayerAttack(player);
    const animalAttack = this.calculateAnimalAttack(animal);
    const playerDefense = this.calculatePlayerDefense(player);
    const animalDefense = this.calculateAnimalDefense(animal);

    // Calculate damage
    const damageToAnimal = Math.max(1, playerAttack - animalDefense);
    const damageToPlayer = Math.max(1, animalAttack - playerDefense);

    // Determine if player wins (based on stats comparison and luck)
    const playerCombatPower = player.stats.str + player.stats.dex + (player.stats.luck * 0.5);
    const animalCombatPower = animal.stats.str + animal.stats.dex;
    const powerRatio = playerCombatPower / (playerCombatPower + animalCombatPower);
    
    // Add randomness based on luck
    const luckBonus = (player.stats.luck / 100) * 0.2;
    const victoryChance = Math.min(0.95, Math.max(0.05, powerRatio + luckBonus));
    const victory = Math.random() < victoryChance;

    if (victory) {
      return {
        victory: true,
        damageTaken: Math.floor(damageToPlayer * 0.5), // Player takes less damage when winning
        damageDealt: damageToAnimal,
        rewards: animal.rewards,
        message: `You defeated the ${animal.name}! You took ${Math.floor(damageToPlayer * 0.5)} damage but gained valuable resources.`,
      };
    } else {
      return {
        victory: false,
        damageTaken: damageToPlayer,
        damageDealt: damageToAnimal,
        message: `The ${animal.name} was too strong! You took ${damageToPlayer} damage and were forced to retreat.`,
      };
    }
  }

  private calculatePlayerAttack(player: Player): number {
    return player.stats.str * 2 + player.stats.dex + (player.level * 2);
  }

  private calculateAnimalAttack(animal: WildAnimal): number {
    return animal.stats.str * 2 + animal.stats.dex + (animal.level * 2);
  }

  private calculatePlayerDefense(player: Player): number {
    return player.stats.str + player.stats.dex * 0.5 + (player.level * 1);
  }

  private calculateAnimalDefense(animal: WildAnimal): number {
    return animal.stats.str + animal.stats.dex * 0.5 + (animal.level * 1);
  }
}

