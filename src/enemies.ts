import type { Enemy, World } from "./types";

export type EnemyKind = "grunt" | "rusher" | "tank" | "elite";

interface EnemyTemplate {
  hp: number;
  damage: number;
  speed: number;
  radius: number;
  color: string;
  xp: number;
  gold: number;
}

const TEMPLATES: Record<EnemyKind, EnemyTemplate> = {
  grunt:  { hp: 8,  damage: 4,  speed: 38,  radius: 1.5, color: "#d94f4f", xp: 2, gold: 1 },
  rusher: { hp: 5,  damage: 3,  speed: 70,  radius: 1.2, color: "#d9954f", xp: 2, gold: 1 },
  tank:   { hp: 28, damage: 8,  speed: 22,  radius: 2.5, color: "#9a4fd9", xp: 6, gold: 3 },
  elite:  { hp: 60, damage: 12, speed: 32,  radius: 3.0, color: "#f5c542", xp: 14, gold: 8 },
};

// Wave scaling: HP and damage grow over time so deep builds keep mattering.
function scaleForWave(t: EnemyTemplate, wave: number): EnemyTemplate {
  const k = 1 + (wave - 1) * 0.18;
  const dk = 1 + (wave - 1) * 0.10;
  return {
    ...t,
    hp: Math.round(t.hp * k),
    damage: Math.round(t.damage * dk),
    xp: Math.round(t.xp * Math.sqrt(k)),
    gold: Math.round(t.gold * Math.sqrt(k)),
  };
}

function spawnPositionOnEdge(world: World): { x: number; y: number } {
  const { w, h } = world.arena;
  const edge = Math.floor(world.rng() * 4);
  const margin = 8;
  switch (edge) {
    case 0: return { x: world.rng() * w, y: margin };
    case 1: return { x: w - margin, y: world.rng() * h };
    case 2: return { x: world.rng() * w, y: h - margin };
    default: return { x: margin, y: world.rng() * h };
  }
}

function pickKind(wave: number, rng: () => number): EnemyKind {
  // weighted pool that shifts as waves progress
  const r = rng();
  if (wave >= 5 && r < 0.05) return "elite";
  if (wave >= 3 && r < 0.20) return "tank";
  if (r < 0.45) return "rusher";
  return "grunt";
}

export function spawnEnemy(world: World): Enemy {
  const kind = pickKind(world.wave, world.rng);
  const tpl = scaleForWave(TEMPLATES[kind], world.wave);
  const p = spawnPositionOnEdge(world);
  const e: Enemy = {
    pos: p,
    vel: { x: 0, y: 0 },
    hp: tpl.hp,
    maxHp: tpl.hp,
    damage: tpl.damage,
    speed: tpl.speed,
    radius: tpl.radius,
    color: tpl.color,
    xp: tpl.xp,
    gold: tpl.gold,
    contactCooldownMs: 600,
    lastContactAt: 0,
  };
  return e;
}
