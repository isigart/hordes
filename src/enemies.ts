import type { Enemy, World } from "./types";
import { getBiome, type BiomeConfig } from "./biomes";

export type EnemyKind = "grunt" | "rusher" | "tank" | "elite";

interface EnemyTemplate {
  hp: number;
  damage: number;
  speed: number;
  radius: number;
  xp: number;
  gold: number;
}

const TEMPLATES: Record<EnemyKind, EnemyTemplate> = {
  grunt:  { hp: 8,  damage: 4,  speed: 38,  radius: 0.5, xp: 2, gold: 1 },
  rusher: { hp: 5,  damage: 3,  speed: 70,  radius: 0.5, xp: 2, gold: 1 },
  tank:   { hp: 28, damage: 8,  speed: 22,  radius: 1.0, xp: 6, gold: 3 },
  elite:  { hp: 60, damage: 12, speed: 32,  radius: 1.5, xp: 14, gold: 8 },
};

function scaleForWave(t: EnemyTemplate, wave: number): EnemyTemplate {
  const k = 1 + Math.sqrt(Math.max(0, wave - 1)) * 0.40;
  const dk = 1 + Math.sqrt(Math.max(0, wave - 1)) * 0.25;
  return {
    ...t,
    hp: Math.round(t.hp * k),
    damage: Math.round(t.damage * dk),
    xp: Math.round(t.xp * Math.sqrt(k)),
    gold: Math.round(t.gold * Math.sqrt(k)),
  };
}

function pickKind(wave: number, rng: () => number): EnemyKind {
  const r = rng();
  if (wave >= 5 && r < 0.05) return "elite";
  if (wave >= 3 && r < 0.20) return "tank";
  if (r < 0.45) return "rusher";
  return "grunt";
}

function colorForKind(kind: EnemyKind, biome: BiomeConfig): string {
  return biome.palette[kind];
}

// Position helpers per formation kind ----------------------------------

export function spawnPositionForBiome(world: World, biome: BiomeConfig): { x: number; y: number } {
  const { w, h } = world.arena;
  const margin = 8;
  switch (biome.formation) {
    case "multi_dir": {
      const r = world.rng();
      if (r < 0.6) return { x: margin + world.rng() * (w - margin * 2), y: margin };
      if (r < 0.80) return { x: margin, y: margin + world.rng() * (h * 0.55) };
      return { x: w - margin, y: margin + world.rng() * (h * 0.55) };
    }
    case "top_random":
    case "top_cluster":
    case "top_wave":
    default:
      return { x: margin + world.rng() * (w - margin * 2), y: margin };
  }
}

// Build a single enemy from a template. Position is set by the caller.
function buildEnemy(world: World, kind: EnemyKind, biome: BiomeConfig): Enemy {
  const tpl = scaleForWave(TEMPLATES[kind], world.wave);
  const speed = tpl.speed;
  return {
    pos: { x: 0, y: 0 },
    vel: { x: 0, y: 0 },
    hp: tpl.hp,
    maxHp: tpl.hp,
    damage: tpl.damage,
    speed,
    baseSpeed: speed,
    radius: tpl.radius,
    color: colorForKind(kind, biome),
    xp: tpl.xp,
    gold: tpl.gold,
    contactCooldownMs: 600,
    lastContactAt: 0,
    burn: null, slow: null, poison: null, vulnerable: null,
    targetHeroIndex: -1,
    mechanic: biome.mechanic,
    isBoss: false,
    phaseUntil: 0,
    reviveUsed: false,
  };
}

export function spawnEnemy(world: World): Enemy {
  const biome = getBiome(world.wave);
  const kind = pickKind(world.wave, world.rng);
  const e = buildEnemy(world, kind, biome);
  const p = spawnPositionForBiome(world, biome);
  e.pos = p;
  return e;
}

// Spawn a small CLUSTER of enemies near a point — used by top_cluster.
export function spawnCluster(world: World, count = 5): Enemy[] {
  const biome = getBiome(world.wave);
  const center = spawnPositionForBiome(world, biome);
  const out: Enemy[] = [];
  for (let i = 0; i < count; i++) {
    const kind = pickKind(world.wave, world.rng);
    const e = buildEnemy(world, kind, biome);
    e.pos = {
      x: center.x + (world.rng() - 0.5) * 24,
      y: center.y + world.rng() * 6,
    };
    out.push(e);
  }
  return out;
}

// Spawn a horizontal ROW of enemies across the top — used by top_wave.
export function spawnRow(world: World, count = 10): Enemy[] {
  const biome = getBiome(world.wave);
  const margin = 12;
  const span = world.arena.w - margin * 2;
  const out: Enemy[] = [];
  for (let i = 0; i < count; i++) {
    const kind = pickKind(world.wave, world.rng);
    const e = buildEnemy(world, kind, biome);
    const x = margin + ((i + 0.5) / count) * span + (world.rng() - 0.5) * 6;
    e.pos = { x, y: 8 };
    out.push(e);
  }
  return out;
}

// Spawn a boss — one big enemy reusing the elite template + biome multipliers.
export function spawnBoss(world: World): Enemy {
  const biome = getBiome(world.wave);
  const tpl = scaleForWave(TEMPLATES.elite, world.wave);
  const m = biome.boss;
  return {
    pos: { x: world.arena.w / 2, y: 12 },
    vel: { x: 0, y: 0 },
    hp: Math.round(tpl.hp * m.hpMult),
    maxHp: Math.round(tpl.hp * m.hpMult),
    damage: Math.round(tpl.damage * m.dmgMult),
    speed: tpl.speed * m.speedMult,
    baseSpeed: tpl.speed * m.speedMult,
    radius: m.radius,
    color: biome.palette.boss,
    xp: tpl.xp * 12,
    gold: tpl.gold * 15,
    contactCooldownMs: 800,
    lastContactAt: 0,
    burn: null, slow: null, poison: null, vulnerable: null,
    targetHeroIndex: -1,
    mechanic: biome.mechanic,
    isBoss: true,
    phaseUntil: 0,
    reviveUsed: false,
  };
}
