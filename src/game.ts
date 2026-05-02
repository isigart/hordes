import type {
  DamageNumber, Enemy, Hero, Projectile, World, XpOrb,
} from "./types";
import { derived, gainXp } from "./stats";
import { spawnEnemy } from "./enemies";
import { startWave } from "./waves";

const ORB_PICKUP_RADIUS = 14;
const ORB_ATTRACT_RADIUS = 80;
const HERO_RADIUS = 4;

// Seedable RNG (mulberry32).
export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createWorld(arenaW: number, arenaH: number, seed: number): World {
  return {
    hero: null,
    enemies: [],
    projectiles: [],
    dmgNumbers: [],
    orbs: [],
    wave: 0,
    waveStartedAt: 0,
    waveDurationMs: 0,
    enemiesToSpawn: 0,
    spawnAccumMs: 0,
    phase: "menu",
    arena: { w: arenaW, h: arenaH },
    now: 0,
    lastFrame: 0,
    rng: makeRng(seed),
  };
}

// --- helpers ---
function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function findNearestEnemy(hero: Hero, enemies: Enemy[], maxRange: number): Enemy | null {
  let best: Enemy | null = null;
  let bestD = maxRange;
  for (const e of enemies) {
    const d = dist(hero.pos, e.pos);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

function pushDamageNumber(world: World, x: number, y: number, dmg: number, crit: boolean) {
  world.dmgNumbers.push({
    pos: { x, y: y - 8 },
    text: String(Math.round(dmg)),
    ttl: 700,
    age: 0,
    color: crit ? "#f5c542" : "#d8d8e2",
  });
}

function applyDamageToEnemy(world: World, e: Enemy, baseDmg: number, isCrit: boolean) {
  const dmg = isCrit ? baseDmg : baseDmg;
  e.hp -= dmg;
  pushDamageNumber(world, e.pos.x, e.pos.y, dmg, isCrit);
  if (e.hp <= 0) {
    // drop xp orb
    world.orbs.push({
      pos: { x: e.pos.x, y: e.pos.y },
      amount: e.xp,
      vel: { x: 0, y: 0 },
    });
    if (world.hero) {
      const d = derived(world.hero);
      world.hero.gold += Math.round(e.gold * d.goldMult);
    }
  }
}

// --- hero attack ---
function tryHeroAttack(world: World, dt: number) {
  void dt;
  const hero = world.hero;
  if (!hero) return;
  const d = derived(hero);
  const cd = hero.cls.attackCooldownMs / d.aspd;
  if (world.now - hero.lastAttackAt < cd) return;

  const target = findNearestEnemy(hero, world.enemies, hero.cls.attackRange);
  if (!target) return;

  hero.lastAttackAt = world.now;
  hero.facing = Math.atan2(target.pos.y - hero.pos.y, target.pos.x - hero.pos.x);

  switch (hero.cls.attackKind) {
    case "melee_aoe": {
      const r = hero.cls.aoeRadius ?? 50;
      for (const e of world.enemies) {
        if (dist(hero.pos, e.pos) <= r) {
          rollAndApply(world, hero, e, "phys");
        }
      }
      break;
    }
    case "ranged_single": {
      const speed = hero.cls.projectileSpeed ?? 400;
      const vx = Math.cos(hero.facing) * speed;
      const vy = Math.sin(hero.facing) * speed;
      world.projectiles.push(makeProjectile(hero, vx, vy, "phys", 1));
      break;
    }
    case "ranged_aoe": {
      const speed = hero.cls.projectileSpeed ?? 320;
      const vx = Math.cos(hero.facing) * speed;
      const vy = Math.sin(hero.facing) * speed;
      const p = makeProjectile(hero, vx, vy, "magic", 0);
      p.radius = 4;
      world.projectiles.push(p);
      break;
    }
  }
}

function rollAndApply(world: World, hero: Hero, enemy: Enemy, kind: "phys" | "magic") {
  const d = derived(hero);
  const mult = kind === "magic" ? d.magicMult : d.physMult;
  const base = hero.cls.baseDamage * mult;
  const isCrit = world.rng() < d.critChance;
  const dmg = Math.max(1, base * (isCrit ? d.critDamage : 1));
  applyDamageToEnemy(world, enemy, dmg, isCrit);
}

function makeProjectile(hero: Hero, vx: number, vy: number, kind: "phys" | "magic", pierce: number): Projectile {
  const d = derived(hero);
  const mult = kind === "magic" ? d.magicMult : d.physMult;
  const isCrit = Math.random() < d.critChance;
  const dmg = Math.max(1, hero.cls.baseDamage * mult * (isCrit ? d.critDamage : 1));
  return {
    pos: { x: hero.pos.x, y: hero.pos.y },
    vel: { x: vx, y: vy },
    damage: dmg,
    isCrit,
    ttl: 1500,
    color: kind === "magic" ? "#b06fd9" : "#e8e8f0",
    radius: kind === "magic" ? 2 : 1,
    pierceLeft: pierce,
    hitSet: new Set(),
  };
}

// --- enemy update ---
function updateEnemies(world: World, dt: number) {
  const hero = world.hero;
  if (!hero) return;
  const sec = dt / 1000;
  const d = derived(hero);
  for (let i = world.enemies.length - 1; i >= 0; i--) {
    const e = world.enemies[i];
    if (e.hp <= 0) {
      world.enemies.splice(i, 1);
      continue;
    }
    // move toward hero
    const dx = hero.pos.x - e.pos.x;
    const dy = hero.pos.y - e.pos.y;
    const dd = Math.sqrt(dx * dx + dy * dy) || 1;
    e.vel.x = (dx / dd) * e.speed;
    e.vel.y = (dy / dd) * e.speed;
    e.pos.x += e.vel.x * sec;
    e.pos.y += e.vel.y * sec;

    // contact damage
    const touchDist = HERO_RADIUS + e.radius + 1;
    if (dd <= touchDist && world.now - e.lastContactAt >= e.contactCooldownMs) {
      const reduced = e.damage * (1 - d.dmgReduction);
      hero.hp -= Math.max(1, reduced);
      e.lastContactAt = world.now;
      pushDamageNumber(world, hero.pos.x, hero.pos.y, reduced, false);
      if (hero.hp <= 0) {
        hero.hp = 0;
        world.phase = "dead";
      }
    }
  }
}

// --- projectile update ---
function updateProjectiles(world: World, dt: number) {
  const sec = dt / 1000;
  for (let i = world.projectiles.length - 1; i >= 0; i--) {
    const p = world.projectiles[i];
    p.pos.x += p.vel.x * sec;
    p.pos.y += p.vel.y * sec;
    p.ttl -= dt;

    let consumed = false;

    for (const e of world.enemies) {
      if (e.hp <= 0) continue;
      if (p.hitSet.has(e)) continue;
      const r = e.radius + p.radius + 0.5;
      if (dist(p.pos, e.pos) <= r) {
        if (p.color === "#b06fd9") {
          // AOE: damage all enemies in blast radius around impact
          const blast = 60;
          for (const e2 of world.enemies) {
            if (e2.hp <= 0) continue;
            if (dist(p.pos, e2.pos) <= blast) {
              applyDamageToEnemy(world, e2, p.damage, p.isCrit);
            }
          }
          consumed = true;
          break;
        } else {
          applyDamageToEnemy(world, e, p.damage, p.isCrit);
          p.hitSet.add(e);
          if (p.pierceLeft <= 0) { consumed = true; break; }
          p.pierceLeft -= 1;
        }
      }
    }

    const out =
      p.pos.x < -10 || p.pos.x > world.arena.w + 10 ||
      p.pos.y < -10 || p.pos.y > world.arena.h + 10;
    if (consumed || p.ttl <= 0 || out) {
      world.projectiles.splice(i, 1);
    }
  }
}

// --- orbs ---
function updateOrbs(world: World, dt: number) {
  const hero = world.hero;
  if (!hero) return;
  const sec = dt / 1000;
  for (let i = world.orbs.length - 1; i >= 0; i--) {
    const o = world.orbs[i];
    const dx = hero.pos.x - o.pos.x, dy = hero.pos.y - o.pos.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    if (d <= ORB_PICKUP_RADIUS) {
      gainXp(hero, o.amount);
      world.orbs.splice(i, 1);
      continue;
    }
    if (d <= ORB_ATTRACT_RADIUS) {
      const speed = 220;
      o.vel.x = (dx / d) * speed;
      o.vel.y = (dy / d) * speed;
      o.pos.x += o.vel.x * sec;
      o.pos.y += o.vel.y * sec;
    }
  }
}

// --- damage numbers ---
function updateDamageNumbers(world: World, dt: number) {
  for (let i = world.dmgNumbers.length - 1; i >= 0; i--) {
    const n = world.dmgNumbers[i];
    n.age += dt;
    n.pos.y -= 0.04 * dt;
    if (n.age >= n.ttl) world.dmgNumbers.splice(i, 1);
  }
}

// --- spawn enemies during a wave ---
function updateSpawning(world: World, dt: number) {
  if (world.phase !== "playing") return;
  if (world.enemiesToSpawn <= 0) return;

  // spawn rate scales so all enemies spawn over ~80% of wave duration
  const spawnInterval = (world.waveDurationMs * 0.8) / world.enemiesToSpawn;
  world.spawnAccumMs += dt;
  while (world.spawnAccumMs >= spawnInterval && world.enemiesToSpawn > 0) {
    world.enemies.push(spawnEnemy(world));
    world.spawnAccumMs -= spawnInterval;
    world.enemiesToSpawn -= 1;
  }
}

// --- regen ---
function updateRegen(world: World, dt: number) {
  if (!world.hero) return;
  const d = derived(world.hero);
  const heal = d.hpRegen * (dt / 1000);
  world.hero.hp = Math.min(d.maxHp, world.hero.hp + heal);
}

// --- wave end check ---
function checkWaveEnd(world: World) {
  if (world.phase !== "playing") return;
  if (world.enemiesToSpawn <= 0 && world.enemies.length === 0) {
    world.phase = "wave_clear";
  }
}

// --- main step ---
export function step(world: World, dtMs: number) {
  world.now += dtMs;
  if (world.phase === "playing") {
    updateSpawning(world, dtMs);
    updateEnemies(world, dtMs);
    tryHeroAttack(world, dtMs);
    updateProjectiles(world, dtMs);
    updateOrbs(world, dtMs);
    updateRegen(world, dtMs);
    checkWaveEnd(world);
  }
  // damage numbers always tick (so they fade out on game over)
  updateDamageNumbers(world, dtMs);
}

export function nextWave(world: World) {
  if (!world.hero) return;
  startWave(world, world.wave + 1);
}

// --- xp orb constructor for outside callers ---
export function dropOrb(world: World, x: number, y: number, amount: number) {
  const o: XpOrb = { pos: { x, y }, amount, vel: { x: 0, y: 0 } };
  world.orbs.push(o);
}

// --- damage number for outside callers ---
export function flashDamage(world: World, x: number, y: number, dmg: number, crit: boolean) {
  const dn: DamageNumber = {
    pos: { x, y },
    text: String(Math.round(dmg)),
    ttl: 700,
    age: 0,
    color: crit ? "#f5c542" : "#d8d8e2",
  };
  world.dmgNumbers.push(dn);
}

export const GAME_CONSTANTS = { HERO_RADIUS };
