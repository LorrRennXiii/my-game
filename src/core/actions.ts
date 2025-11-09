import type { ActionType, ActionResult, Player, Tribe, PlayerSkills } from '../types.js';
import { PlayerManager } from './player.js';
import { TribeManager } from './tribe.js';

export class ActionManager {
  private playerManager: PlayerManager;
  private tribeManager: TribeManager;

  constructor(playerManager: PlayerManager, tribeManager: TribeManager) {
    this.playerManager = playerManager;
    this.tribeManager = tribeManager;
  }

  executeAction(actionType: ActionType, npcId?: string): ActionResult {
    const player = this.playerManager.getPlayer();
    const tribe = this.tribeManager.getTribe();

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

    // Apply rewards
    if (result.rewards) {
      if (result.rewards.xp) {
        const leveledUp = this.playerManager.addXP(result.rewards.xp);
        if (leveledUp) {
          result.message += `\n🌟 You leveled up! You are now level ${this.playerManager.getPlayer().level}.`;
        }
      }
      if (result.rewards.food) {
        this.playerManager.updateInventory({ food: result.rewards.food });
        this.tribeManager.updateResources({ food: result.rewards.food });
      }
      if (result.rewards.materials) {
        this.playerManager.updateInventory({ materials: result.rewards.materials });
        this.tribeManager.updateResources({ materials: result.rewards.materials });
      }
      if (result.rewards.wealth) {
        this.playerManager.updateInventory({ wealth: result.rewards.wealth });
        this.tribeManager.updateResources({ wealth: result.rewards.wealth });
      }
      if (result.rewards.spirit_energy) {
        this.playerManager.updateInventory({ spirit_energy: result.rewards.spirit_energy });
        this.tribeManager.updateResources({ spirit_energy: result.rewards.spirit_energy });
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
    
    // success_chance = base_chance + (related_stat * 5%) + (skill_level * 10%) + (luck * 2%)
    return Math.min(95, baseChance + (relatedStat * 5) + (skillLevel * 10) + (player.stats.luck * 2));
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
        return {
          success: true,
          partial: false,
          message: "You discover something interesting during your exploration!",
          rewards: {
            xp: 5,
            materials: 3,
            spirit_energy: 2
          }
        };
      
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
    if (skill && Math.random() < 0.3) { // 30% chance to improve skill
      this.playerManager.improveSkill(skill, 1);
    }
  }
}

