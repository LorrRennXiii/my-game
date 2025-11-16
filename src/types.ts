export interface PlayerStats {
  str: number
  dex: number
  wis: number
  cha: number
  luck: number
}

export interface PlayerSkills {
  farming: number
  gathering: number
  trading: number
  social: number
  hunting?: number
  combat?: number
  magic?: number
}

export interface PlayerInventory {
  food: number
  materials: number
  wealth: number
  spirit_energy?: number
}

// Item System
export type ItemType = 'consumable' | 'weapon' | 'armor' | 'accessory' | 'material' | 'misc'
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export interface ItemStats {
  str?: number
  dex?: number
  wis?: number
  cha?: number
  luck?: number
  health?: number
  maxHealth?: number
  stamina?: number
  maxStamina?: number
  damage?: number
  defense?: number
}

export interface Item {
  id: string
  name: string
  type: ItemType
  rarity: ItemRarity
  description: string
  icon: string // Emoji or icon identifier
  stats?: ItemStats
  stackable: boolean
  maxStack?: number
  quantity?: number // For stackable items
  level?: number // Required level to use
  sellValue?: number // Value when sold
  consumableEffect?: {
    health?: number
    stamina?: number
    duration?: number // For temporary effects
  }
}

export interface EquipmentSlots {
  weapon?: Item | null
  armor?: Item | null
  accessory1?: Item | null
  accessory2?: Item | null
  accessory3?: Item | null
}

export interface LootTable {
  items: Array<{
    item: Item
    chance: number // 0-100 percentage
    minQuantity?: number
    maxQuantity?: number
  }>
}

export interface Player {
  name: string
  tribe: string
  job: string
  level: number
  xp: number
  stats: PlayerStats
  skills: PlayerSkills
  inventory: PlayerInventory
  stamina: number
  maxStamina: number
  health: number
  maxHealth: number
  relationships: Record<string, number>
  flags: Record<string, boolean>
  restDaysRemaining?: number // Days remaining in rest state (0 = not resting)
  bag?: Item[] // Inventory bag (like Diablo)
  equipment?: EquipmentSlots // Equipped items
}

export interface TribeAttributes {
  prosperity: number
  defense: number
  knowledge: number
  spirit: number
  morale: number
}

export interface TribeResources {
  food: number
  materials: number
  wealth: number
  spirit_energy?: number
}

export interface Tribe {
  name: string
  attributes: TribeAttributes
  resources: TribeResources
}

export type ActionType = 'farm' | 'gather' | 'hunt' | 'trade' | 'visit' | 'explore'

export interface ActionResult {
  success: boolean
  partial: boolean
  message: string
  rewards?: {
    xp?: number
    food?: number
    materials?: number
    wealth?: number
    spirit_energy?: number
    items?: Item[] // Loot items
  }
  effects?: {
    stamina?: number
    relationship?: Record<string, number>
  }
  event?: Event
  npcEvent?: any
  encounter?: any
  exploreEncounter?: {
    animal: WildAnimal
    requiresDecision: boolean
  }
  combatResult?: CombatResult
}

export interface NPCStats {
  str: number
  dex: number
  wis: number
  cha: number
  luck?: number
}

export interface NPC {
  id: string
  name: string
  role: string
  tribe: string
  disposition: 'friendly' | 'neutral' | 'hostile'
  level?: number
  xp?: number
  stats?: NPCStats
  growth_path?: 'warrior' | 'merchant' | 'mystic' | 'hunter' | 'farmer' | 'elder'
  location?: { x: number; y: number }
  encountered?: boolean
  flags?: Record<string, boolean>
}

export interface Event {
  id: string
  type: 'daily' | 'action' | 'npc' | 'tribe_milestone'
  text: string
  effects: {
    food?: number
    materials?: number
    wealth?: number
    spirit_energy?: number
    morale?: number
    prosperity?: number
    defense?: number
    knowledge?: number
    spirit?: number
  }
  conditions?: {
    tribe?: string
    day?: number
    prosperity?: number
    morale?: number
  }
}

export interface WildAnimal {
  id: string
  name: string
  level: number
  stats: {
    str: number
    dex: number
    health: number
    maxHealth: number
  }
  rewards: {
    xp: number
    food: number
    materials: number
    wealth: number
  }
  damage: number
  image?: string
}

export interface CombatResult {
  victory: boolean
  damageTaken: number
  damageDealt: number
  rewards?: {
    xp?: number
    food?: number
    materials?: number
    wealth?: number
    items?: Item[] // Loot from combat
  }
  message: string
}
