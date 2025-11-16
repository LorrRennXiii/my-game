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
  health: number;
  maxHealth: number;
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
  location?: {
    x: number;
    y: number;
    map: string;
  };
  encountered?: boolean;
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
  encounter?: {
    success: boolean;
    message: string;
    rewards?: any;
    effects?: any;
  };
  exploreEncounter?: {
    animal: WildAnimal;
    requiresDecision: boolean;
  };
  combatResult?: CombatResult;
}

export type ActionType = "farm" | "gather" | "trade" | "visit" | "hunt" | "explore";

export interface WildAnimal {
  id: string;
  name: string;
  level: number;
  stats: {
    str: number;
    dex: number;
    health: number;
    maxHealth: number;
  };
  rewards: {
    xp?: number;
    food?: number;
    materials?: number;
    wealth?: number;
  };
  damage: number; // Base damage the animal can deal
}

export interface CombatResult {
  victory: boolean;
  damageTaken: number;
  damageDealt: number;
  rewards?: {
    xp?: number;
    food?: number;
    materials?: number;
    wealth?: number;
  };
  message: string;
}

