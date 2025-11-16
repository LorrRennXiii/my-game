import type { ActionType, ActionResult, Player, Tribe, PlayerSkills, WildAnimal, CombatResult, Item } from '../types.js';
import { PlayerManager } from './player.js';
import { TribeManager } from './tribe.js';
import { CombatManager } from './combat.js';
import { ItemManager } from './items.js';
import type { GameConfigManager } from './gameConfig.js';

export class ActionManager {
  private playerManager: PlayerManager;
  private tribeManager: TribeManager;
  private combatManager: CombatManager;
  private itemManager: ItemManager;
  private configManager?: GameConfigManager;

  constructor(playerManager: PlayerManager, tribeManager: TribeManager, configManager?: GameConfigManager) {
    this.playerManager = playerManager;
    this.tribeManager = tribeManager;
    this.combatManager = new CombatManager();
    this.itemManager = new ItemManager();
    this.configManager = configManager;
  }

  setConfigManager(configManager: GameConfigManager): void {
    this.configManager = configManager;
  }

  executeAction(actionType: ActionType, npcId?: string): ActionResult {
    const player = this.playerManager.getPlayer();
    const tribe = this.tribeManager.getTribe();

    // Check if player is resting (health <= 0)
    if (this.playerManager.isResting()) {
      const restDays = this.playerManager.getRestDaysRemaining();
      return {
        success: false,
        partial: false,
        message: `You are too injured to perform actions. You need to rest for ${restDays} more day${restDays > 1 ? 's' : ''} to recover.`
      };
    }

    // Check stamina
    const staminaCost = this.getStaminaCost(actionType);
    if (!this.playerManager.spendStamina(staminaCost)) {
      return {
        success: false,
        partial: false,
        message: "You are too tired to perform this action. Rest and try again tomorrow."
      };
    }

    // Calculate success chance
    const successChance = this.calculateSuccessChance(actionType, player);
    const roll = Math.random() * 100;
    const partialMargin = 12;

    let result: ActionResult;

    if (roll <= successChance) {
      result = this.handleSuccess(actionType, player, tribe, npcId);
    } else if (roll <= successChance + partialMargin) {
      result = this.handlePartialSuccess(actionType, player, tribe, npcId);
    } else {
      result = this.handleFailure(actionType, player, tribe, npcId);
    }

    // Generate loot items based on action (only on success/partial success)
    const lootItems: Item[] = [];
    if (result.success || result.partial) {
      const loot = this.itemManager.generateLoot(actionType, player.level, player.stats.luck);
      lootItems.push(...loot);
    }
    
    // Add loot items to bag
    const lootMessages: string[] = [];
    for (const item of lootItems) {
      const added = this.playerManager.addItemToBag(item);
      if (added) {
        const quantity = item.quantity || 1;
        lootMessages.push(`${item.icon} ${item.name}${quantity > 1 ? ` x${quantity}` : ''}`);
      } else {
        lootMessages.push(`⚠️ ${item.name} - Bag is full!`);
      }
    }

    // Add loot to rewards
    if (lootItems.length > 0) {
      if (!result.rewards) {
        result.rewards = {};
      }
      result.rewards.items = lootItems;
      if (lootMessages.length > 0) {
        result.message += `\n📦 Loot: ${lootMessages.join(', ')}`;
      }
    }

    // Apply rewards
    if (result.rewards) {
      if (result.rewards.xp) {
        const xpMultiplier = this.configManager?.getXpMultiplier() || 1.0
        const levelUpMultiplier = this.configManager?.getLevelUpXpMultiplier() || 1.0
        const leveledUp = this.playerManager.addXP(result.rewards.xp, xpMultiplier, levelUpMultiplier);
        if (leveledUp) {
          const player = this.playerManager.getPlayer();
          result.message += `\n🌟 You leveled up! You are now level ${player.level}.`;
          result.message += `\n⚡ Your max stamina increased to ${player.maxStamina}!`;
          result.message += `\n❤️ Your max health increased to ${player.maxHealth}!`;
        }
      }
      const rewardMultiplier = this.configManager?.getActionRewardMultiplier() || 1.0
      if (result.rewards.food) {
        const adjustedFood = Math.floor(result.rewards.food * rewardMultiplier)
        this.playerManager.updateInventory({ food: adjustedFood });
        this.tribeManager.updateResources({ food: adjustedFood });
      }
      if (result.rewards.materials) {
        const adjustedMaterials = Math.floor(result.rewards.materials * rewardMultiplier)
        this.playerManager.updateInventory({ materials: adjustedMaterials });
        this.tribeManager.updateResources({ materials: adjustedMaterials });
      }
      if (result.rewards.wealth) {
        const adjustedWealth = Math.floor(result.rewards.wealth * rewardMultiplier)
        this.playerManager.updateInventory({ wealth: adjustedWealth });
        this.tribeManager.updateResources({ wealth: adjustedWealth });
      }
      if (result.rewards.spirit_energy) {
        const adjustedSpirit = Math.floor(result.rewards.spirit_energy * rewardMultiplier)
        this.playerManager.updateInventory({ spirit_energy: adjustedSpirit });
        this.tribeManager.updateResources({ spirit_energy: adjustedSpirit });
      }
    }

    // Update skills
    this.updateSkills(actionType);

    // Update tribe prosperity
    this.tribeManager.calculateProsperity();

    return result;
  }

  private getStaminaCost(actionType: ActionType): number {
    const costs: Record<ActionType, number> = {
      farm: 1,
      gather: 1,
      trade: 1,
      visit: 1,
      hunt: 2,
      explore: 2
    };
    return costs[actionType] || 1;
  }

  private calculateSuccessChance(actionType: ActionType, player: Player): number {
    const baseChances: Record<ActionType, number> = {
      farm: 70,
      gather: 80,
      trade: 65,
      visit: 100,
      hunt: 60,
      explore: 50
    };

    const baseChance = baseChances[actionType] || 50;
    const relatedStat = this.getRelatedStat(actionType, player);
    const skillLevel = this.getRelatedSkill(actionType, player);
    const successBonus = this.configManager?.getConfig().actionSuccessBonus || 0
    
    // success_chance = base_chance + (related_stat * 5%) + (skill_level * 10%) + (luck * 2%) + config_bonus
    return Math.min(95, Math.max(5, baseChance + (relatedStat * 5) + (skillLevel * 10) + (player.stats.luck * 2) + successBonus));
  }

  private getRelatedStat(actionType: ActionType, player: Player): number {
    const statMap: Record<ActionType, keyof typeof player.stats> = {
      farm: 'wis',
      gather: 'dex',
      trade: 'cha',
      visit: 'cha',
      hunt: 'str',
      explore: 'luck'
    };
    return player.stats[statMap[actionType] || 'str'];
  }

  private getRelatedSkill(actionType: ActionType, player: Player): number {
    const skillMap: Record<ActionType, keyof typeof player.skills> = {
      farm: 'farming',
      gather: 'gathering',
      trade: 'trading',
      visit: 'social',
      hunt: 'hunting',
      explore: 'gathering'
    };
    return this.playerManager.getSkillLevel(skillMap[actionType] || 'gathering');
  }

  private handleSuccess(actionType: ActionType, player: Player, tribe: Tribe, npcId?: string): ActionResult {
    switch (actionType) {
      case "farm":
        return {
          success: true,
          partial: false,
          message: "You successfully tend to the fields. The crops look healthy and bountiful.",
          rewards: {
            xp: 3,
            food: 3
          }
        };
      
      case "gather":
        return {
          success: true,
          partial: false,
          message: "You find valuable herbs and materials in the wilderness.",
          rewards: {
            xp: 2,
            materials: 4
          }
        };
      
      case "trade":
        return {
          success: true,
          partial: false,
          message: "You make a profitable trade with a passing merchant.",
          rewards: {
            xp: 2,
            wealth: 15
          }
        };
      
      case "visit":
        if (npcId) {
          const relationshipChange = 5 + Math.floor(Math.random() * 5);
          this.playerManager.updateRelationship(npcId, relationshipChange);
          return {
            success: true,
            partial: false,
            message: `You have a pleasant conversation with ${npcId}. Your relationship improves.`,
            rewards: {
              xp: 1
            },
            effects: {
              relationship: { [npcId]: relationshipChange }
            }
          };
        }
        return {
          success: true,
          partial: false,
          message: "You spend time with the tribe members, strengthening bonds.",
          rewards: {
            xp: 1
          }
        };
      
      case "hunt":
        return {
          success: true,
          partial: false,
          message: "You return from the hunt with fresh meat and pelts.",
          rewards: {
            xp: 4,
            food: 5,
            materials: 2
          }
        };
      
      case "explore":
        // This is handled by handleExplore method
        return this.handleExplore(actionType, player, tribe);
      
      default:
        return {
          success: true,
          partial: false,
          message: "Action completed successfully.",
          rewards: { xp: 1 }
        };
    }
  }

  private handlePartialSuccess(actionType: ActionType, player: Player, tribe: Tribe, npcId?: string): ActionResult {
    switch (actionType) {
      case "farm":
        return {
          success: false,
          partial: true,
          message: "Your farming efforts yield modest results. The weather wasn't ideal.",
          rewards: {
            xp: 1,
            food: 1
          }
        };
      
      case "gather":
        return {
          success: false,
          partial: true,
          message: "You find some materials, but not as much as you hoped.",
          rewards: {
            xp: 1,
            materials: 2
          }
        };
      
      case "trade":
        return {
          success: false,
          partial: true,
          message: "The trade was fair, but not particularly profitable.",
          rewards: {
            xp: 1,
            wealth: 5
          }
        };
      
      case "visit":
        return {
          success: false,
          partial: true,
          message: "The conversation was pleasant but uneventful.",
          rewards: {
            xp: 1
          }
        };
      
      case "hunt":
        return {
          success: false,
          partial: true,
          message: "You catch a small game, but the larger prey eluded you.",
          rewards: {
            xp: 2,
            food: 2
          }
        };
      
      case "explore":
        return {
          success: false,
          partial: true,
          message: "Your exploration reveals little of interest today.",
          rewards: {
            xp: 2
          }
        };
      
      default:
        return {
          success: false,
          partial: true,
          message: "Action completed with mixed results.",
          rewards: { xp: 1 }
        };
    }
  }

  private handleFailure(actionType: ActionType, player: Player, tribe: Tribe, npcId?: string): ActionResult {
    switch (actionType) {
      case "farm":
        return {
          success: false,
          partial: false,
          message: "A pest infestation damages your crops. You gain nothing today."
        };
      
      case "gather":
        return {
          success: false,
          partial: false,
          message: "You return empty-handed. The gathering spots were picked clean."
        };
      
      case "trade":
        return {
          success: false,
          partial: false,
          message: "The merchant drives a hard bargain. You lose wealth in a bad deal.",
          rewards: {
            wealth: -5
          }
        };
      
      case "visit":
        if (npcId) {
          const relationshipChange = -2;
          this.playerManager.updateRelationship(npcId, relationshipChange);
          return {
            success: false,
            partial: false,
            message: `Your visit with ${npcId} was awkward. The relationship suffers slightly.`,
            effects: {
              relationship: { [npcId]: relationshipChange }
            }
          };
        }
        return {
          success: false,
          partial: false,
          message: "You spend time alone, feeling disconnected from the tribe."
        };
      
      case "hunt":
        return {
          success: false,
          partial: false,
          message: "You return from the hunt empty-handed and exhausted. A close encounter with a beast left you shaken."
        };
      
      case "explore":
        return {
          success: false,
          partial: false,
          message: "Your exploration leads you into danger. You barely escape unharmed, but gain nothing."
        };
      
      default:
        return {
          success: false,
          partial: false,
          message: "Action failed."
        };
    }
  }

  private updateSkills(actionType: ActionType): void {
    const skillMap: Record<ActionType, keyof PlayerSkills> = {
      farm: 'farming',
      gather: 'gathering',
      trade: 'trading',
      visit: 'social',
      hunt: 'hunting',
      explore: 'gathering'
    };

    const skill = skillMap[actionType];
    const improvementChance = this.configManager?.getSkillImprovementChance() || 30
    if (skill && Math.random() < (improvementChance / 100)) {
      this.playerManager.improveSkill(skill, 1);
    }
  }

  private handleExplore(actionType: ActionType, player: Player, tribe: Tribe): ActionResult {
    // Explore action - chance to encounter wild animals
    const encounterChance = 0.4; // 40% chance to encounter an animal
    
    if (Math.random() < encounterChance) {
      // Generate wild animal encounter
      const animal = this.combatManager.generateWildAnimal(player.level);
      
      // Return encounter result that requires player decision
      return {
        success: true,
        partial: false,
        message: `You encounter a ${animal.name} (Level ${animal.level}) in the wilds!`,
        exploreEncounter: {
          animal: animal,
          requiresDecision: true
        }
      };
    } else {
      // Normal exploration without encounter
      const success = Math.random() < this.calculateSuccessChance(actionType, player);
      
      if (success) {
        const xpGain = 5 + Math.floor(Math.random() * 5);
        const materialGain = 3 + Math.floor(Math.random() * 5);
        const wealthGain = 2 + Math.floor(Math.random() * 3);
        
        return {
          success: true,
          partial: false,
          message: `You explored the wilds and discovered valuable resources!`,
          rewards: {
            xp: xpGain,
            materials: materialGain,
            wealth: wealthGain
          }
        };
      } else {
        return {
          success: false,
          partial: false,
          message: "Your exploration yielded nothing. The wilds are dangerous."
        };
      }
    }
  }

  /**
   * Execute combat with a wild animal
   */
  executeCombat(animal: WildAnimal): CombatResult {
    const player = this.playerManager.getPlayer();
    const combatResult = this.combatManager.calculateCombat(player, animal);
    
    // Apply damage to player
    this.playerManager.takeDamage(combatResult.damageTaken);
    
    // Check if player is now in resting state
    const isNowResting = this.playerManager.isResting();
    const currentHealth = this.playerManager.getHealth();
    
    // Update combat result message if player is knocked out
    if (isNowResting && currentHealth <= 0) {
      combatResult.message += ` You have been knocked out and must rest for 3 days to recover.`;
    }
    
    // Generate combat loot
    const combatPlayer = this.playerManager.getPlayer();
    const combatLoot = this.itemManager.generateLoot('hunt', combatPlayer.level, combatPlayer.stats.luck);
    
    // Add combat loot to combat result
    if (combatLoot.length > 0) {
      if (!combatResult.rewards) {
        combatResult.rewards = {};
      }
      combatResult.rewards.items = combatLoot;
    }

    // Apply rewards if victorious (only if not knocked out)
    if (combatResult.victory && combatResult.rewards && !isNowResting) {
      if (combatResult.rewards.xp) {
        const xpMultiplier = this.configManager?.getXpMultiplier() || 1.0
        const levelUpMultiplier = this.configManager?.getLevelUpXpMultiplier() || 1.0
        this.playerManager.addXP(combatResult.rewards.xp, xpMultiplier, levelUpMultiplier);
      }
      if (combatResult.rewards.food) {
        this.playerManager.updateInventory({ food: combatResult.rewards.food });
        this.tribeManager.updateResources({ food: combatResult.rewards.food });
      }
      if (combatResult.rewards.materials) {
        this.playerManager.updateInventory({ materials: combatResult.rewards.materials });
        this.tribeManager.updateResources({ materials: combatResult.rewards.materials });
      }
      if (combatResult.rewards.wealth) {
        this.playerManager.updateInventory({ wealth: combatResult.rewards.wealth });
        this.tribeManager.updateResources({ wealth: combatResult.rewards.wealth });
      }
      // Add combat loot items to bag
      if (combatResult.rewards.items) {
        for (const item of combatResult.rewards.items) {
          this.playerManager.addItemToBag(item);
        }
      }
    }
    
    return combatResult;
  }
}

