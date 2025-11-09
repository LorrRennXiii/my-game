import type { NPC, Player } from '../types.js';

export class NPCManager {
  private npcs: Map<string, NPC>;

  constructor(npcs: NPC[] = []) {
    this.npcs = new Map();
    npcs.forEach(npc => this.npcs.set(npc.id, npc));
  }

  getNPC(id: string): NPC | undefined {
    return this.npcs.get(id);
  }

  getAllNPCs(): NPC[] {
    return Array.from(this.npcs.values());
  }

  getNPCsByTribe(tribe: string): NPC[] {
    return Array.from(this.npcs.values()).filter(npc => npc.tribe === tribe);
  }

  calculateReaction(player: Player, npcId: string): {
    score: number;
    level: "Hostile" | "Neutral" | "Friendly" | "Ally";
  } {
    const npc = this.npcs.get(npcId);
    if (!npc) {
      return { score: 0, level: "Neutral" };
    }

    const relationship = player.relationships[npcId] || 50;
    const reactionScore = (player.stats.cha * 2) + relationship + (Math.random() * 20 - 10);

    let level: "Hostile" | "Neutral" | "Friendly" | "Ally";
    if (reactionScore < 20) {
      level = "Hostile";
    } else if (reactionScore < 50) {
      level = "Neutral";
    } else if (reactionScore < 80) {
      level = "Friendly";
    } else {
      level = "Ally";
    }

    return { score: reactionScore, level };
  }

  updateRelationship(npcId: string, change: number): void {
    const npc = this.npcs.get(npcId);
    if (npc) {
      npc.relationship = Math.max(0, Math.min(100, npc.relationship + change));
    }
  }

  setFlag(npcId: string, flag: string, value: boolean): void {
    const npc = this.npcs.get(npcId);
    if (npc) {
      npc.flags[flag] = value;
    }
  }

  getFlag(npcId: string, flag: string): boolean {
    const npc = this.npcs.get(npcId);
    return npc?.flags[flag] || false;
  }

  addNPC(npc: NPC): void {
    this.npcs.set(npc.id, npc);
  }
}

