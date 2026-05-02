// Core types for Hordes

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

export interface Vec2 {
  x: number;
  y: number;
}

export type HeroClassId = "knight" | "archer" | "mage";

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
  pos: Vec2;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpToNext: number;
  unspentPoints: number;
  stats: Stats; // base + allocated
  lastAttackAt: number;
  facing: number; // radians
  gold: number;
}

export interface Enemy {
  pos: Vec2;
  vel: Vec2;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  radius: number;
  color: string;
  xp: number;
  gold: number;
  contactCooldownMs: number;
  lastContactAt: number;
}

export interface Projectile {
  pos: Vec2;
  vel: Vec2;
  damage: number;
  isCrit: boolean;
  ttl: number;
  color: string;
  radius: number;
  pierceLeft: number;
  hitSet: Set<Enemy>;
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

export type GamePhase = "menu" | "playing" | "wave_clear" | "dead";

export interface World {
  hero: Hero | null;
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
}
