// Core types for Hordes — v2 (team of 5, shared gem budget, individual stats)

import type { MetaProgress } from "./meta";

export type StatKey =
  | "STR" // physical damage
  | "AGI" // attack speed
  | "INT" // skill damage
  | "VIT" // max HP
  | "DEX" // crit chance
  | "WIS" // cooldown reduction
  | "END" // damage reduction
  | "LCK"; // gold drop, crit damage

export const STAT_KEYS: StatKey[] = ["STR", "AGI", "INT", "VIT", "DEX", "WIS", "END", "LCK"];

export type Stats = Record<StatKey, number>;

export interface Vec2 { x: number; y: number; }

export type HeroClassId = "knight" | "healer" | "summoner" | "archer" | "mage";

export interface HeroClass {
  id: HeroClassId;
  name: string;
  blurb: string;
  baseStats: Stats;
  baseHp: number;
  baseDamage: number;
  attackRange: number;
  attackCooldownMs: number;
  color: string;
  attackKind: "melee_aoe" | "ranged_single" | "ranged_aoe";
  projectileSpeed?: number;
  aoeRadius?: number;
}

export interface Hero {
  cls: HeroClass;
  heroIndex: number; // 0..4 — slot in team formation
  pos: Vec2;
  hp: number;
  maxHp: number;
  level: number; // mirrors world-shared level (still stored for convenience)
  unspentPoints: number;
  stats: Stats;
  lastAttackAt: number;
  facing: number;
  gems: Gem[];
  // passive runtime state
  shieldHp: number;
  lastDamageAt: number;
  firstAidUsed: boolean;
  bloodlustStacks: number;
  bloodlustExpiresAt: number;
  sanctuaryNextAt: number;
  pendingMultishots: { remaining: number; nextAt: number }[];
  lastSummonAt: number;
  synergies: Set<string>; // talent-tagged behaviors (read-only at runtime)
  enemyHitMemory: Set<Enemy>; // for "first shot on a new enemy" type effects
  phoenixUsed: boolean; // healer phoenix talent: 1×/run revive
  avatarUsed: boolean;  // knight avatar talent: 1×/run cheat death
  attackCounter: number; // for whirlwind etc.
}

// --- Minions (summoner pets) ---
export interface Minion {
  pos: Vec2;
  vel: Vec2;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  radius: number;
  ttl: number; // ms remaining; -1 = permanent
  attackRange: number;
  attackCooldownMs: number;
  lastAttackAt: number;
  ownerIndex: number;
  color: string;
}

// --- Gems / build system ---

export interface Gem {
  id: string;
  name: string;
  blurb: string;
  category: "soin" | "defense" | "offensive" | "statut" | "pattern" | "utilite";
  cost: number; // 2 | 3 | 4
  effects: GemEffect[];
}

export type GemEffect =
  | { kind: "dmgMult"; v: number }
  | { kind: "cdMult"; v: number }
  | { kind: "critChance"; v: number }
  | { kind: "critDmg"; v: number }
  | { kind: "lifesteal"; v: number }
  | { kind: "pierce"; v: number }
  | { kind: "chain"; count: number; range: number; falloff: number }
  | { kind: "multishot"; extra: number }
  | { kind: "aoeMult"; v: number }
  | { kind: "burn"; dpsRatio: number; duration: number }
  | { kind: "slow"; v: number; duration: number }
  | { kind: "regen"; v: number; dmgCooldownMs: number }
  | { kind: "firstAid"; threshold: number; ratio: number }
  | { kind: "sanctuary"; heal: number; radius: number; intervalMs: number }
  | { kind: "lowHpDmg"; threshold: number; v: number }
  | { kind: "shield"; max: number; regenPerSec: number }
  | { kind: "executioner"; threshold: number; v: number }
  | { kind: "predator"; threshold: number; v: number }
  | { kind: "bloodlust"; perStack: number; maxStacks: number; durationMs: number }
  | { kind: "poison"; perStack: number; duration: number; stacksPerHit: number }
  | { kind: "hex"; mult: number; duration: number }
  | { kind: "knockback"; v: number }
  | { kind: "goldMult"; v: number }
  | { kind: "taunt"; radius: number };

export interface BuildProfile {
  // attack-time multipliers
  dmgMult: number;
  cdMult: number;
  critChanceBonus: number;
  critDmgBonus: number;
  lifesteal: number;
  pierce: number;
  chainCount: number;
  chainRange: number;
  chainFalloff: number;
  multishot: number;
  aoeMult: number;
  // on-hit status applied to the enemy
  burn: { dpsRatio: number; duration: number } | null;
  slow: { v: number; duration: number } | null;
  poison: { perStack: number; duration: number; stacksPerHit: number } | null;
  hex: { mult: number; duration: number } | null;
  knockback: number;
  // conditional damage modifiers
  lowHpDmgBonus: number;
  lowHpDmgThreshold: number;
  executionerBonus: number;
  executionerThreshold: number;
  predatorBonus: number;
  predatorThreshold: number;
  // passive systems
  regen: { v: number; dmgCooldownMs: number } | null;
  sanctuary: { heal: number; radius: number; intervalMs: number } | null;
  shield: { max: number; regenPerSec: number } | null;
  firstAid: { threshold: number; ratio: number } | null;
  bloodlust: { perStack: number; maxStacks: number; durationMs: number } | null;
  goldMult: number;
  taunt: { radius: number } | null;
}

export interface BurnStatus { dps: number; ttl: number; }
export interface SlowStatus { mult: number; ttl: number; }
export interface PoisonStatus { stacks: number; ttl: number; perStackDps: number; }
export interface VulnStatus { mult: number; ttl: number; }

export interface Enemy {
  pos: Vec2;
  vel: Vec2;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  baseSpeed: number; // unmodified speed for pack/charge logic
  radius: number;
  color: string;
  xp: number;
  gold: number;
  contactCooldownMs: number;
  lastContactAt: number;
  burn: BurnStatus | null;
  slow: SlowStatus | null;
  poison: PoisonStatus | null;
  vulnerable: VulnStatus | null;
  targetHeroIndex: number; // -1 if no target
  // biome-specific behavior tags
  mechanic: "none" | "pack" | "poison" | "charge" | "ambush" | "chill" | "burst" | "revive" | "phase" | "void";
  isBoss: boolean;
  // mechanic-specific runtime fields
  phaseUntil: number; // ms timestamp until which this enemy is invulnerable
  reviveUsed: boolean;
}

export interface Projectile {
  pos: Vec2;
  vel: Vec2;
  damage: number; // base damage pre-crit
  ownerIndex: number; // hero who fired it
  ttl: number;
  color: string;
  radius: number;
  pierceLeft: number;
  hitSet: Set<Enemy>;
  isAoe: boolean;
  blastRadius: number;
  chainLeft: number;
  chainRange: number;
  chainFalloff: number;
  burn: { dpsRatio: number; duration: number } | null;
  slow: { v: number; duration: number } | null;
  poison: { perStack: number; duration: number; stacksPerHit: number } | null;
  hex: { mult: number; duration: number } | null;
  knockback: number;
  lifesteal: number;
}

export interface DamageNumber {
  pos: Vec2;
  text: string;
  ttl: number;
  age: number;
  color: string;
}

export interface XpOrb {
  pos: Vec2;
  amount: number;
  vel: Vec2;
}

export type GamePhase = "menu" | "playing" | "draft" | "dead";

export interface World {
  heroes: Hero[]; // length 0 in menu, 5 once playing
  activeHeroIndex: number; // which hero panel is expanded
  level: number; // shared team level
  xp: number;
  xpToNext: number;
  gold: number;
  socketBudget: number; // total — recomputed from base + level + bosses
  bossesDefeated: number;
  enemies: Enemy[];
  projectiles: Projectile[];
  dmgNumbers: DamageNumber[];
  orbs: XpOrb[];
  wave: number;
  waveStartedAt: number;
  waveDurationMs: number;
  enemiesToSpawn: number;
  spawnAccumMs: number;
  phase: GamePhase;
  arena: { w: number; h: number };
  now: number;
  lastFrame: number;
  rng: () => number;
  draftOffer: Gem[];
  draftPickedIndex: number; // -1 if no gem chosen yet, else index in draftOffer
  timeScale: number; // 1, 2, or 4 — fast-forward simulation
  zoom: number;      // 1 = battlefield view, up to 4× zoom
  minions: Minion[];
  meta: MetaProgress;
}
