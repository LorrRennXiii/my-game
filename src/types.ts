export interface PlayerStats {
  str: number;
  dex: number;
  wis: number;
  cha: number;
  luck: number;
}

export interface PlayerSkills {
  farming: number;
  gathering: number;
  trading: number;
  social: number;
  hunting?: number;
  combat?: number;
  magic?: number;
}

export interface PlayerInventory {
  food: number;
  materials: number;
  wealth: number;
  spirit_energy?: number;
}

export interface Player {
  name: string;
  tribe: string;
  job: string;
  level: number;
  xp: number;
  stats: PlayerStats;
  skills: PlayerSkills;
  inventory: PlayerInventory;
  stamina: number;
  maxStamina: number;
  relationships: Record<string, number>;
  flags: Record<string, boolean>;
}

export interface TribeAttributes {
  prosperity: number;
  defense: number;
  knowledge: number;
  spirit: number;
  morale: number;
}

export interface TribeResources {
  food: number;
  materials: number;
  wealth: number;
  spirit_energy: number;
}

export interface Tribe {
  name: string;
  attributes: TribeAttributes;
  resources: TribeResources;
}

export interface NPCStats {
  str: number;
  dex: number;
  wis: number;
  cha: number;
  luck: number;
}

export interface NPC {
  id: string;
  name: string;
  tribe: string;
  role: string;
  disposition: "Friendly" | "Neutral" | "Hostile";
  relationship: number;
  growth_path: string;
  level: number;
  xp: number;
  stats: NPCStats;
  flags: Record<string, boolean>;
}

export interface Event {
  id: string;
  type: "daily" | "action" | "npc" | "tribe_milestone";
  condition?: string;
  text: string;
  effects: {
    food?: number;
    materials?: number;
    wealth?: number;
    spirit_energy?: number;
    morale?: number;
    prosperity?: number;
    defense?: number;
    knowledge?: number;
    spirit?: number;
  };
}

export interface ActionResult {
  success: boolean;
  partial: boolean;
  message: string;
  rewards?: {
    xp?: number;
    food?: number;
    materials?: number;
    wealth?: number;
    spirit_energy?: number;
  };
  effects?: {
    stamina?: number;
    relationship?: Record<string, number>;
  };
  event?: Event;
  npcEvent?: Event;
}

export type ActionType = "farm" | "gather" | "trade" | "visit" | "hunt" | "explore";

