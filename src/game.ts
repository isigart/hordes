import type {
  BuildProfile, DamageNumber, Enemy, Hero, Minion, Projectile, World, XpOrb,
} from "./types";
import { derived, gainXpShared, xpForLevel } from "./stats";
import { spawnBoss, spawnCluster, spawnEnemy, spawnRow } from "./enemies";
import { startWave } from "./waves";
import { aggregateProfile, emptyProfile, pickDraftOffer, totalGemCost } from "./gems";
import { spawnTeam } from "./heroes";
import { getBiome, isBossWave } from "./biomes";
import { awardWaveClearPoint, loadMeta, startNewCycle } from "./meta";

const ORB_PICKUP_RADIUS = 14;
// No attract-radius cap — orbs always travel to the nearest living hero. This
// matters in the tower-defense layout where mobs die far from the back-line.
const HERO_RADIUS = 0.5; // 1 hero = 1 px, same scale as a grunt
const BASE_BUDGET = 8;
const BUDGET_PER_LEVEL_TIER = 5;   // +1 budget every 5 levels
const BUDGET_PER_BOSS = 2;          // +2 budget per boss defeated

export function computeSocketBudget(level: number, bossesDefeated: number): number {
  return BASE_BUDGET + Math.floor(level / BUDGET_PER_LEVEL_TIER) + bossesDefeated * BUDGET_PER_BOSS;
}

export function refreshSocketBudget(world: World) {
  world.socketBudget = computeSocketBudget(world.level, world.bossesDefeated);
}

export function budgetBreakdown(world: World): { base: number; fromLevel: number; fromBosses: number; total: number } {
  const fromLevel = Math.floor(world.level / BUDGET_PER_LEVEL_TIER);
  const fromBosses = world.bossesDefeated * BUDGET_PER_BOSS;
  return { base: BASE_BUDGET, fromLevel, fromBosses, total: BASE_BUDGET + fromLevel + fromBosses };
}

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
    heroes: [],
    activeHeroIndex: 0,
    level: 1,
    xp: 0,
    xpToNext: xpForLevel(1),
    gold: 0,
    socketBudget: BASE_BUDGET,
    bossesDefeated: 0,
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
    draftOffer: [],
    draftPickedIndex: -1,
    timeScale: 1,
    zoom: 1,
    minions: [],
    meta: loadMeta(),
  };
}

export function setTimeScale(world: World, scale: number) {
  if (scale === 1 || scale === 2 || scale === 4) world.timeScale = scale;
}

export function setZoom(world: World, zoom: number) {
  world.zoom = Math.max(1, Math.min(4, zoom));
}

export function zoomIn(world: World) {
  setZoom(world, Math.min(4, world.zoom + 0.5));
}

export function zoomOut(world: World) {
  setZoom(world, Math.max(1, world.zoom - 0.5));
}

export function startRun(world: World) {
  startNewCycle(world.meta);
  world.heroes = spawnTeam(world.arena.w, world.arena.h, world.meta);
  world.level = 1;
  world.xp = 0;
  world.xpToNext = xpForLevel(1);
  world.gold = 0;
  world.wave = 0;
  world.activeHeroIndex = 0;
  world.draftOffer = [];
  world.draftPickedIndex = -1;
  world.enemies = [];
  world.projectiles = [];
  world.dmgNumbers = [];
  world.orbs = [];
  world.minions = [];
  world.bossesDefeated = 0;
  refreshSocketBudget(world);
  nextWave(world);
}

// --- minions / summoner --------------------------------------------------
const SUMMON_BASE_CD = 4500;
const MINION_TTL = 8000;

function maxMinionsFor(hero: Hero): number {
  let m = 1;
  for (const g of hero.gems) if (g.id === "armysize") m += 1;
  if (hero.synergies.has("summoner_armysize1")) m += 1;
  if (hero.synergies.has("summoner_armysize2")) m += 1;
  // Champion talent collapses the cap to 1 (but with strong stats)
  if (hero.synergies.has("summoner_champion")) m = 1;
  return m;
}

function minionMods(hero: Hero): { hp: number; dmg: number } {
  let hp = 1, dmg = 1;
  for (const g of hero.gems) if (g.id === "minionpower") { hp *= 1.5; dmg *= 1.5; }
  // Champion talent: collapse to 1 minion but ×3 stats
  if (hero.synergies.has("summoner_champion")) { hp *= 3; dmg *= 3; }
  return { hp, dmg };
}

function spawnMinion(world: World, hero: Hero) {
  const mods = minionMods(hero);
  const m: Minion = {
    pos: { x: hero.pos.x + (world.rng() - 0.5) * 6, y: hero.pos.y - 4 },
    vel: { x: 0, y: 0 },
    hp: 18 * mods.hp,
    maxHp: 18 * mods.hp,
    damage: 4 * mods.dmg,
    speed: 60,
    radius: 0.5,
    ttl: MINION_TTL,
    attackRange: 12,
    attackCooldownMs: 600,
    lastAttackAt: 0,
    ownerIndex: hero.heroIndex,
    color: "#c8c8b0",
  };
  world.minions.push(m);
}

function updateSummoners(world: World) {
  for (const hero of world.heroes) {
    if (hero.cls.id !== "summoner") continue;
    if (hero.hp <= 0) continue;
    const d = derived(hero);
    const profile = aggregateProfile(hero.gems);
    let cd = (SUMMON_BASE_CD * profile.cdMult) / d.aspd;
    if (hero.synergies.has("summoner_summoncd")) cd *= 0.75;
    if (world.now - hero.lastSummonAt < cd) continue;
    const mine = world.minions.filter(m => m.ownerIndex === hero.heroIndex).length;
    if (mine >= maxMinionsFor(hero)) continue;
    spawnMinion(world, hero);
    hero.lastSummonAt = world.now;
  }
}

function updateMinions(world: World, dt: number) {
  const sec = dt / 1000;
  for (let i = world.minions.length - 1; i >= 0; i--) {
    const m = world.minions[i];
    m.ttl -= dt;
    if (m.ttl <= 0 || m.hp <= 0) {
      // Death Nova check: any owner gem with id "deathnova" → AOE damage
      const owner = world.heroes[m.ownerIndex];
      if (owner) {
        const hasNova = owner.gems.some(g => g.id === "deathnova");
        if (hasNova) {
          const blast = 60;
          const dmg = m.damage * 2;
          for (const e of world.enemies) {
            if (e.hp <= 0) continue;
            if (dist(m.pos, e.pos) <= blast) {
              e.hp -= dmg;
              pushDamageNumber(world, e.pos.x, e.pos.y, dmg, false);
            }
          }
        }
      }
      world.minions.splice(i, 1);
      continue;
    }
    // find target
    const target = findNearestEnemy(m.pos, world.enemies, 9999);
    if (!target) continue;
    // move toward target until in range
    const dx = target.pos.x - m.pos.x;
    const dy = target.pos.y - m.pos.y;
    const dd = Math.sqrt(dx * dx + dy * dy) || 1;
    if (dd > m.attackRange) {
      m.pos.x += (dx / dd) * m.speed * sec;
      m.pos.y += (dy / dd) * m.speed * sec;
    }
    // attack
    if (dd <= m.attackRange + target.radius && world.now - m.lastAttackAt >= m.attackCooldownMs) {
      target.hp -= m.damage;
      pushDamageNumber(world, target.pos.x, target.pos.y, m.damage, false);
      m.lastAttackAt = world.now;
    }
  }
}

// ---------- helpers ----------
function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function isAlive(h: Hero): boolean { return h.hp > 0; }

function livingHeroes(world: World): Hero[] {
  return world.heroes.filter(isAlive);
}

function findNearestLivingHero(world: World, pos: { x: number; y: number }): Hero | null {
  let best: Hero | null = null;
  let bestD = Infinity;
  for (const h of world.heroes) {
    if (!isAlive(h)) continue;
    const d = dist(pos, h.pos);
    if (d < bestD) { bestD = d; best = h; }
  }
  return best;
}

function findNearestEnemy(
  pos: { x: number; y: number },
  enemies: Enemy[],
  maxRange: number,
  exclude?: Set<Enemy>,
): Enemy | null {
  let best: Enemy | null = null;
  let bestD = maxRange;
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    if (exclude && exclude.has(e)) continue;
    const d = dist(pos, e.pos);
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

// ---------- damage application ----------
// Compute final damage on enemy given source hero's profile and a base value.
// Applies conditional modifiers (executioner, predator, lowHpDmg, bloodlust, hex).
function computeFinalDamage(
  base: number,
  hero: Hero,
  profile: BuildProfile,
  enemy: Enemy,
  isCrit: boolean,
  critDmgMult: number,
): number {
  let dmg = base;
  // bloodlust stack bonus
  if (profile.bloodlust && hero.bloodlustStacks > 0 && hero.bloodlustExpiresAt > 0) {
    dmg *= 1 + hero.bloodlustStacks * profile.bloodlust.perStack;
  }
  // low HP self bonus
  if (profile.lowHpDmgBonus > 0) {
    if (hero.hp / hero.maxHp <= profile.lowHpDmgThreshold) dmg *= 1 + profile.lowHpDmgBonus;
  }
  // executioner (low enemy HP)
  if (profile.executionerBonus > 0) {
    if (enemy.hp / enemy.maxHp <= profile.executionerThreshold) dmg *= 1 + profile.executionerBonus;
  }
  // predator (high enemy HP)
  if (profile.predatorBonus > 0) {
    if (enemy.hp / enemy.maxHp >= profile.predatorThreshold) dmg *= 1 + profile.predatorBonus;
  }
  if (isCrit) dmg *= critDmgMult;
  // hex vulnerability on enemy (multiplies all incoming damage)
  if (enemy.vulnerable) dmg *= enemy.vulnerable.mult;
  return Math.max(1, dmg);
}

// Apply damage and on-hit status effects from a hero/projectile profile.
function applyHit(
  world: World,
  enemy: Enemy,
  hero: Hero,
  profile: BuildProfile,
  base: number, // pre-mult, used to scale DoT/poison
  preCritDmg: number, // already computed with conditional, pre-crit
) {
  if (enemy.hp <= 0) return;

  const d = derived(hero);
  const critChance = Math.min(0.95, d.critChance + profile.critChanceBonus);
  const critDmg = d.critDamage + profile.critDmgBonus;
  const isCrit = world.rng() < critChance;

  const dmg = computeFinalDamage(preCritDmg, hero, profile, enemy, isCrit, critDmg);
  enemy.hp -= dmg;
  pushDamageNumber(world, enemy.pos.x, enemy.pos.y, dmg, isCrit);

  // lifesteal heals the source hero
  if (profile.lifesteal !== 0 && isAlive(hero)) {
    const heal = dmg * profile.lifesteal;
    hero.hp = Math.max(0, Math.min(hero.maxHp, hero.hp + heal));
  }

  // burn refresh
  if (profile.burn) {
    const dps = base * profile.burn.dpsRatio;
    if (!enemy.burn || enemy.burn.dps < dps) {
      enemy.burn = { dps, ttl: profile.burn.duration };
    } else {
      enemy.burn.ttl = Math.max(enemy.burn.ttl, profile.burn.duration);
    }
  }
  // slow
  if (profile.slow) {
    const mult = 1 - profile.slow.v;
    if (!enemy.slow || enemy.slow.mult > mult) {
      enemy.slow = { mult, ttl: profile.slow.duration };
    } else {
      enemy.slow.ttl = Math.max(enemy.slow.ttl, profile.slow.duration);
    }
  }
  // poison stacks
  if (profile.poison) {
    const perStackDps = base * profile.poison.perStack;
    if (!enemy.poison) {
      enemy.poison = {
        stacks: profile.poison.stacksPerHit,
        ttl: profile.poison.duration,
        perStackDps,
      };
    } else {
      enemy.poison.stacks += profile.poison.stacksPerHit;
      enemy.poison.ttl = profile.poison.duration; // refresh
      enemy.poison.perStackDps = Math.max(enemy.poison.perStackDps, perStackDps);
    }
  }
  // hex
  if (profile.hex) {
    if (!enemy.vulnerable || enemy.vulnerable.mult < profile.hex.mult) {
      enemy.vulnerable = { mult: profile.hex.mult, ttl: profile.hex.duration };
    } else {
      enemy.vulnerable.ttl = Math.max(enemy.vulnerable.ttl, profile.hex.duration);
    }
  }
  // knockback away from source hero
  if (profile.knockback > 0) {
    const dx = enemy.pos.x - hero.pos.x;
    const dy = enemy.pos.y - hero.pos.y;
    const m = Math.sqrt(dx * dx + dy * dy) || 1;
    enemy.pos.x = clamp(enemy.pos.x + (dx / m) * profile.knockback, 4, world.arena.w - 4);
    enemy.pos.y = clamp(enemy.pos.y + (dy / m) * profile.knockback, 4, world.arena.h - 4);
  }

  if (enemy.hp <= 0) onEnemyKilled(world, enemy, hero, profile);
}

function onEnemyKilled(world: World, enemy: Enemy, source: Hero, profile: BuildProfile) {
  // drop xp orb
  world.orbs.push({
    pos: { x: enemy.pos.x, y: enemy.pos.y },
    amount: enemy.xp,
    vel: { x: 0, y: 0 },
  });
  // gold (use source's stat-based goldMult and gem-based goldMult)
  const d = derived(source);
  const gold = Math.round(enemy.gold * d.goldMult * profile.goldMult);
  world.gold += gold;
  // bloodlust stack on source
  if (profile.bloodlust) {
    const max = profile.bloodlust.maxStacks;
    source.bloodlustStacks = Math.min(max, source.bloodlustStacks + 1);
    source.bloodlustExpiresAt = world.now + profile.bloodlust.durationMs;
  }
}

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

// ---------- hero attack ----------
function tryHeroAttack(world: World, hero: Hero) {
  if (!isAlive(hero)) return;
  const d = derived(hero);
  const profile = aggregateProfile(hero.gems);
  const cd = (hero.cls.attackCooldownMs * profile.cdMult) / d.aspd;
  if (world.now - hero.lastAttackAt < cd) return;

  const target = findNearestEnemy(hero.pos, world.enemies, hero.cls.attackRange);
  if (!target) return;

  hero.lastAttackAt = world.now;
  hero.facing = Math.atan2(target.pos.y - hero.pos.y, target.pos.x - hero.pos.x);
  fireAttack(world, hero, profile);

  if (profile.multishot > 0 && hero.cls.attackKind === "melee_aoe") {
    hero.pendingMultishots.push({ remaining: profile.multishot, nextAt: world.now + 180 });
  }
}

function fireAttack(world: World, hero: Hero, profile: BuildProfile) {
  const isMagic = hero.cls.attackKind === "ranged_aoe";
  const d = derived(hero);
  const elemMult = isMagic ? d.magicMult : d.physMult;
  const baseDamage = hero.cls.baseDamage * elemMult;
  const preCrit = baseDamage * profile.dmgMult;

  switch (hero.cls.attackKind) {
    case "melee_aoe": {
      const r = (hero.cls.aoeRadius ?? 50) * profile.aoeMult;
      const hit = new Set<Enemy>();
      for (const e of world.enemies) {
        if (e.hp <= 0) continue;
        if (dist(hero.pos, e.pos) <= r) {
          applyHit(world, e, hero, profile, baseDamage, preCrit);
          hit.add(e);
        }
      }
      // chain to nearest outside radius
      let chainsLeft = profile.chainCount;
      let scale = profile.chainFalloff || 0.5;
      let originPos = hero.pos;
      while (chainsLeft > 0) {
        const next = findNearestEnemy(originPos, world.enemies, profile.chainRange + r, hit);
        if (!next) break;
        applyHit(world, next, hero, profile, baseDamage, preCrit * scale);
        hit.add(next);
        originPos = next.pos;
        chainsLeft -= 1;
        scale *= (profile.chainFalloff || 0.5);
      }
      break;
    }
    case "ranged_single": {
      const speed = hero.cls.projectileSpeed ?? 400;
      const count = 1 + profile.multishot;
      const spread = count > 1 ? 0.18 : 0;
      for (let i = 0; i < count; i++) {
        const offset = count > 1 ? (i - (count - 1) / 2) * spread : 0;
        const ang = hero.facing + offset;
        world.projectiles.push(
          makeProjectile(hero, Math.cos(ang) * speed, Math.sin(ang) * speed, profile, baseDamage, preCrit, false),
        );
      }
      break;
    }
    case "ranged_aoe": {
      const speed = hero.cls.projectileSpeed ?? 320;
      const count = 1 + profile.multishot;
      const spread = count > 1 ? 0.22 : 0;
      for (let i = 0; i < count; i++) {
        const offset = count > 1 ? (i - (count - 1) / 2) * spread : 0;
        const ang = hero.facing + offset;
        world.projectiles.push(
          makeProjectile(hero, Math.cos(ang) * speed, Math.sin(ang) * speed, profile, baseDamage, preCrit, true),
        );
      }
      break;
    }
  }

  // Healer: every attack also pulses a heal to the lowest-HP ally.
  if (hero.cls.id === "healer") {
    let target: Hero | null = null;
    for (const h of world.heroes) {
      if (h.hp <= 0) continue;
      if (h.hp >= h.maxHp) continue;
      if (!target || h.hp / h.maxHp < target.hp / target.maxHp) target = h;
    }
    if (target) {
      let heal = baseDamage * profile.dmgMult * 1.8;
      if (hero.synergies.has("healer_buffheal")) heal *= 1.3;
      target.hp = Math.min(target.maxHp, target.hp + heal);
      pushDamageNumber(world, target.pos.x, target.pos.y, heal, false);
      const last = world.dmgNumbers[world.dmgNumbers.length - 1];
      if (last) last.color = "#6fd97f";
    }
  }
}

function makeProjectile(
  hero: Hero, vx: number, vy: number,
  profile: BuildProfile, baseDamage: number, preCrit: number, isAoe: boolean,
): Projectile {
  void preCrit;
  return {
    pos: { x: hero.pos.x, y: hero.pos.y },
    vel: { x: vx, y: vy },
    damage: baseDamage,
    ownerIndex: hero.heroIndex,
    ttl: 1500,
    color: pickProjectileColor(profile, isAoe),
    radius: isAoe ? 2 : 1,
    pierceLeft: profile.pierce,
    hitSet: new Set(),
    isAoe,
    blastRadius: isAoe ? 30 * profile.aoeMult : 0,
    chainLeft: profile.chainCount,
    chainRange: profile.chainRange,
    chainFalloff: profile.chainFalloff || 0.5,
    burn: profile.burn,
    slow: profile.slow,
    poison: profile.poison,
    hex: profile.hex,
    knockback: profile.knockback,
    lifesteal: profile.lifesteal,
  };
}

function pickProjectileColor(profile: BuildProfile, isAoe: boolean): string {
  if (profile.poison) return "#9fd96f";
  if (profile.burn) return "#ff7a3d";
  if (profile.slow) return "#5fcff5";
  if (profile.chainCount > 0) return "#c8d9ff";
  if (isAoe) return "#b06fd9";
  return "#e8e8f0";
}

// ---------- enemy update ----------
function damageHero(world: World, hero: Hero, raw: number) {
  if (!isAlive(hero)) return;
  const d = derived(hero);
  let dmg = Math.max(1, raw * (1 - d.dmgReduction));
  // Knight Indestructible: at HP < 25%, take 50% less damage
  if (hero.synergies.has("knight_indestructible") && hero.hp / hero.maxHp <= 0.25) {
    dmg *= 0.5;
  }
  // shield absorbs first
  if (hero.shieldHp > 0) {
    const absorbed = Math.min(hero.shieldHp, dmg);
    hero.shieldHp -= absorbed;
    dmg -= absorbed;
  }
  // Knight Avatar: lethal damage instead reduces to 1 HP (once per run)
  if (dmg >= hero.hp && hero.synergies.has("knight_avatar") && !hero.avatarUsed) {
    hero.hp = 1;
    hero.avatarUsed = true;
    pushDamageNumber(world, hero.pos.x, hero.pos.y, raw, false);
    hero.lastDamageAt = world.now;
    return;
  }
  if (dmg > 0) hero.hp -= dmg;
  hero.lastDamageAt = world.now;
  pushDamageNumber(world, hero.pos.x, hero.pos.y, dmg, false);
  // first aid trigger
  const profile = aggregateProfile(hero.gems);
  if (profile.firstAid && !hero.firstAidUsed && hero.hp > 0
      && hero.hp / hero.maxHp <= profile.firstAid.threshold) {
    const heal = hero.maxHp * profile.firstAid.ratio;
    hero.hp = Math.min(hero.maxHp, hero.hp + heal);
    hero.firstAidUsed = true;
  }
  if (hero.hp <= 0) {
    hero.hp = 0;
    onHeroDeath(world, hero);
  }
}

function onHeroDeath(world: World, hero: Hero) {
  // Healer Phoenix: instantly revive the fallen ally at 30% HP, 1×/run
  const phoenix = world.heroes.find(h =>
    h.hp > 0 && h.cls.id === "healer" && h.synergies.has("healer_phoenix") && !h.phoenixUsed
  );
  if (phoenix && hero !== phoenix) {
    phoenix.phoenixUsed = true;
    hero.hp = Math.max(1, Math.round(hero.maxHp * 0.3));
    hero.firstAidUsed = false;
    pushDamageNumber(world, hero.pos.x, hero.pos.y, hero.hp, true);
    const last = world.dmgNumbers[world.dmgNumbers.length - 1];
    if (last) last.color = "#f5c542";
    return;
  }
  // Summoner Spirit Link: spawn a 80%-stats spirit minion at the hero's spot
  const linker = world.heroes.find(h => h.hp > 0 && h.synergies.has("summoner_spiritlink"));
  if (linker) {
    const spirit: Minion = {
      pos: { x: hero.pos.x, y: hero.pos.y },
      vel: { x: 0, y: 0 },
      hp: hero.maxHp * 0.8,
      maxHp: hero.maxHp * 0.8,
      damage: hero.cls.baseDamage * 0.8,
      speed: 50,
      radius: 0.5,
      ttl: -1, // permanent until killed (proc once on host death)
      attackRange: 18,
      attackCooldownMs: 700,
      lastAttackAt: 0,
      ownerIndex: linker.heroIndex,
      color: "#a0a0c8", // ghostly blue
    };
    world.minions.push(spirit);
  }
}

function updateEnemies(world: World, dt: number) {
  const sec = dt / 1000;
  for (let i = world.enemies.length - 1; i >= 0; i--) {
    const e = world.enemies[i];

    // burn DoT
    if (e.burn) {
      e.hp -= e.burn.dps * sec;
      e.burn.ttl -= dt;
      if (e.burn.ttl <= 0) e.burn = null;
    }
    // poison DoT
    if (e.poison) {
      e.hp -= e.poison.stacks * e.poison.perStackDps * sec;
      e.poison.ttl -= dt;
      if (e.poison.ttl <= 0) e.poison = null;
    }
    // slow decay
    if (e.slow) {
      e.slow.ttl -= dt;
      if (e.slow.ttl <= 0) e.slow = null;
    }
    // vulnerability decay
    if (e.vulnerable) {
      e.vulnerable.ttl -= dt;
      if (e.vulnerable.ttl <= 0) e.vulnerable = null;
    }

    if (e.hp <= 0) {
      // DoT killed it: drop loot but no source hero attribution
      world.orbs.push({ pos: { x: e.pos.x, y: e.pos.y }, amount: e.xp, vel: { x: 0, y: 0 } });
      world.gold += e.gold;
      world.enemies.splice(i, 1);
      continue;
    }

    // pick target: prefer a tauntor in range, else nearest living hero
    let target: Hero | null = null;
    for (const h of world.heroes) {
      if (!isAlive(h)) continue;
      const p = aggregateProfile(h.gems);
      if (p.taunt && dist(h.pos, e.pos) <= p.taunt.radius) {
        if (!target || dist(h.pos, e.pos) < dist(target.pos, e.pos)) target = h;
      }
    }
    if (!target) target = findNearestLivingHero(world, e.pos);
    if (!target) continue;
    e.targetHeroIndex = target.heroIndex;

    const slowMult = e.slow ? e.slow.mult : 1;
    const dx = target.pos.x - e.pos.x;
    const dy = target.pos.y - e.pos.y;
    const dd = Math.sqrt(dx * dx + dy * dy) || 1;
    const speed = e.speed * slowMult;
    e.vel.x = (dx / dd) * speed;
    e.vel.y = (dy / dd) * speed;
    e.pos.x += e.vel.x * sec;
    e.pos.y += e.vel.y * sec;

    const touchDist = HERO_RADIUS + e.radius + 1;
    if (dd <= touchDist && world.now - e.lastContactAt >= e.contactCooldownMs) {
      damageHero(world, target, e.damage);
      e.lastContactAt = world.now;
    }
  }
}

// ---------- projectiles ----------
function projectileToCtx(p: Projectile): BuildProfile {
  const prof = emptyProfile();
  prof.lifesteal = p.lifesteal;
  prof.burn = p.burn;
  prof.slow = p.slow;
  prof.poison = p.poison;
  prof.hex = p.hex;
  prof.knockback = p.knockback;
  return prof;
}

function updateProjectiles(world: World, dt: number) {
  const sec = dt / 1000;

  for (let i = world.projectiles.length - 1; i >= 0; i--) {
    const p = world.projectiles[i];
    p.pos.x += p.vel.x * sec;
    p.pos.y += p.vel.y * sec;
    p.ttl -= dt;
    let consumed = false;

    const owner = world.heroes[p.ownerIndex];
    const profForCondit = owner ? aggregateProfile(owner.gems) : emptyProfile();

    for (const e of world.enemies) {
      if (e.hp <= 0) continue;
      if (p.hitSet.has(e)) continue;
      const r = e.radius + p.radius + 0.5;
      if (dist(p.pos, e.pos) > r) continue;

      if (p.isAoe) {
        const blast = p.blastRadius;
        const hit = new Set<Enemy>();
        for (const e2 of world.enemies) {
          if (e2.hp <= 0) continue;
          if (dist(p.pos, e2.pos) <= blast) {
            if (owner) {
              applyHit(world, e2, owner, profForCondit, p.damage, p.damage * profForCondit.dmgMult);
            } else {
              // fallback if owner died mid-flight
              applyHit(world, e2, world.heroes[0], profileFromProjectile(p), p.damage, p.damage);
            }
            hit.add(e2);
          }
        }
        let chainsLeft = p.chainLeft;
        let scale = p.chainFalloff;
        let originPos = { ...p.pos };
        while (chainsLeft > 0) {
          const next = findNearestEnemy(originPos, world.enemies, p.chainRange + blast, hit);
          if (!next) break;
          if (owner) {
            applyHit(world, next, owner, profForCondit, p.damage, p.damage * profForCondit.dmgMult * scale);
          }
          hit.add(next);
          originPos = next.pos;
          chainsLeft -= 1;
          scale *= p.chainFalloff;
        }
        consumed = true;
        break;
      } else {
        if (owner) {
          applyHit(world, e, owner, profForCondit, p.damage, p.damage * profForCondit.dmgMult);
        }
        p.hitSet.add(e);

        // chain from this hit
        let chainsLeft = p.chainLeft;
        let scale = p.chainFalloff;
        let origin = e.pos;
        while (chainsLeft > 0) {
          const next = findNearestEnemy(origin, world.enemies, p.chainRange, p.hitSet);
          if (!next) break;
          if (owner) {
            applyHit(world, next, owner, profForCondit, p.damage, p.damage * profForCondit.dmgMult * scale);
          }
          p.hitSet.add(next);
          origin = next.pos;
          chainsLeft -= 1;
          scale *= p.chainFalloff;
        }
        p.chainLeft = 0;

        if (p.pierceLeft <= 0) { consumed = true; break; }
        p.pierceLeft -= 1;
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

function profileFromProjectile(p: Projectile): BuildProfile {
  return projectileToCtx(p);
}

// ---------- multishot pending ----------
function updatePendingMultishots(world: World) {
  for (const hero of world.heroes) {
    if (!isAlive(hero)) { hero.pendingMultishots = []; continue; }
    const profile = aggregateProfile(hero.gems);
    for (let i = hero.pendingMultishots.length - 1; i >= 0; i--) {
      const m = hero.pendingMultishots[i];
      if (world.now >= m.nextAt) {
        fireAttack(world, hero, profile);
        m.remaining -= 1;
        m.nextAt = world.now + 180;
        if (m.remaining <= 0) hero.pendingMultishots.splice(i, 1);
      }
    }
  }
}

// ---------- passive ticks (regen, sanctuary, shield, bloodlust) ----------
function updatePassives(world: World, dt: number) {
  const sec = dt / 1000;
  for (const hero of world.heroes) {
    if (!isAlive(hero)) continue;
    const profile = aggregateProfile(hero.gems);
    const d = derived(hero);

    // base stat regen
    hero.hp = Math.min(hero.maxHp, hero.hp + d.hpRegen * sec);

    // gem regen (after damage cooldown)
    if (profile.regen) {
      if (world.now - hero.lastDamageAt >= profile.regen.dmgCooldownMs) {
        hero.hp = Math.min(hero.maxHp, hero.hp + profile.regen.v * sec);
      }
    }

    // shield regen (only if shield gem equipped)
    if (profile.shield) {
      const max = profile.shield.max;
      hero.shieldHp = Math.min(max, hero.shieldHp + profile.shield.regenPerSec * sec);
    } else {
      hero.shieldHp = 0;
    }

    // sanctuary pulse
    if (profile.sanctuary && world.now >= hero.sanctuaryNextAt) {
      const radius = profile.sanctuary.radius;
      const heal = profile.sanctuary.heal;
      for (const ally of world.heroes) {
        if (!isAlive(ally)) continue;
        if (dist(hero.pos, ally.pos) <= radius) {
          ally.hp = Math.min(ally.maxHp, ally.hp + heal);
        }
      }
      hero.sanctuaryNextAt = world.now + profile.sanctuary.intervalMs;
    }

    // bloodlust decay
    if (hero.bloodlustStacks > 0 && world.now >= hero.bloodlustExpiresAt) {
      hero.bloodlustStacks = 0;
    }
  }
}

// ---------- orbs ----------
function updateOrbs(world: World, dt: number) {
  const sec = dt / 1000;
  for (let i = world.orbs.length - 1; i >= 0; i--) {
    const o = world.orbs[i];
    const target = findNearestLivingHero(world, o.pos);
    if (!target) continue;
    const dx = target.pos.x - o.pos.x, dy = target.pos.y - o.pos.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    if (d <= ORB_PICKUP_RADIUS) {
      gainXpShared(world, o.amount);
      world.orbs.splice(i, 1);
      continue;
    }
    // Always attract — speed scales up as the orb closes in for snappy feel.
    const speed = 260 + Math.max(0, 200 - d) * 1.5;
    o.vel.x = (dx / d) * speed;
    o.vel.y = (dy / d) * speed;
    o.pos.x += o.vel.x * sec;
    o.pos.y += o.vel.y * sec;
  }
}

function updateDamageNumbers(world: World, dt: number) {
  for (let i = world.dmgNumbers.length - 1; i >= 0; i--) {
    const n = world.dmgNumbers[i];
    n.age += dt;
    n.pos.y -= 0.04 * dt;
    if (n.age >= n.ttl) world.dmgNumbers.splice(i, 1);
  }
}

function updateSpawning(world: World, dt: number) {
  if (world.phase !== "playing") return;
  if (world.enemiesToSpawn <= 0) return;
  const biome = getBiome(world.wave);
  const baseInterval = (world.waveDurationMs * 0.8) / Math.max(1, world.enemiesToSpawn);

  let burst = 1;
  if (biome.formation === "top_cluster") burst = 5;
  else if (biome.formation === "top_wave") burst = 10;

  const interval = baseInterval * burst;
  world.spawnAccumMs += dt;
  while (world.spawnAccumMs >= interval && world.enemiesToSpawn > 0) {
    if (biome.formation === "top_cluster") {
      const count = Math.min(burst, world.enemiesToSpawn);
      for (const e of spawnCluster(world, count)) world.enemies.push(e);
      world.enemiesToSpawn -= count;
    } else if (biome.formation === "top_wave") {
      const count = Math.min(burst, world.enemiesToSpawn);
      for (const e of spawnRow(world, count)) world.enemies.push(e);
      world.enemiesToSpawn -= count;
    } else {
      world.enemies.push(spawnEnemy(world));
      world.enemiesToSpawn -= 1;
    }
    world.spawnAccumMs -= interval;
  }
}

function checkPhaseTransitions(world: World) {
  // game over
  if (world.phase === "playing" && livingHeroes(world).length === 0) {
    world.phase = "dead";
    return;
  }
  // wave clear → draft
  if (world.phase === "playing"
      && world.enemiesToSpawn <= 0
      && world.enemies.length === 0) {
    if (isBossWave(world.wave)) {
      world.bossesDefeated += 1;
    }
    // Award meta-progression talent point for first-time wave clears
    awardWaveClearPoint(world.meta, world.wave);
    refreshSocketBudget(world);
    world.phase = "draft";
    world.draftOffer = pickDraftOffer(world.rng, world.wave);
    world.draftPickedIndex = -1;
    world.projectiles = [];
    world.minions = []; // skeletons don't carry over to the next wave
    // Sweep any straggling XP orbs so nothing is wasted at wave clear.
    for (const o of world.orbs) gainXpShared(world, o.amount);
    world.orbs = [];
    for (const h of world.heroes) {
      if (h.hp > 0) {
        h.hp = h.maxHp;
        h.shieldHp = 0;
      } else {
        h.hp = h.maxHp * 0.5;
        h.firstAidUsed = false;
      }
      h.bloodlustStacks = 0;
      h.pendingMultishots = [];
    }
  }
}

// ---------- main step ----------
export function step(world: World, dtMs: number) {
  world.now += dtMs;
  if (world.phase === "playing") {
    updateSpawning(world, dtMs);
    updateEnemies(world, dtMs);
    for (const h of world.heroes) tryHeroAttack(world, h);
    updateSummoners(world);
    updateMinions(world, dtMs);
    updatePendingMultishots(world);
    updateProjectiles(world, dtMs);
    updateOrbs(world, dtMs);
    updatePassives(world, dtMs);
    refreshSocketBudget(world); // catches level-up budget bumps
    checkPhaseTransitions(world);
  }
  updateDamageNumbers(world, dtMs);
}

export function nextWave(world: World) {
  if (world.heroes.length === 0) return;
  startWave(world, world.wave + 1);
  // Boss waves: spawn the boss now, reduce normal mob count by 40%.
  if (isBossWave(world.wave)) {
    world.enemies.push(spawnBoss(world));
    world.enemiesToSpawn = Math.round(world.enemiesToSpawn * 0.6);
  }
}

// ---------- public draft / gem API ----------
export function pickGemForDraft(world: World, gemIndex: number) {
  if (gemIndex < 0 || gemIndex >= world.draftOffer.length) return;
  world.draftPickedIndex = gemIndex;
}

export function assignGemToHero(world: World, heroIndex: number) {
  if (world.draftPickedIndex < 0) return false;
  const hero = world.heroes[heroIndex];
  if (!hero) return false;
  const gem = world.draftOffer[world.draftPickedIndex];
  if (!gem) return false;
  if (usedBudget(world) + gem.cost > world.socketBudget) return false;
  hero.gems.push(gem);
  world.draftOffer = [];
  world.draftPickedIndex = -1;
  return true;
}

export function removeGemFromHero(world: World, heroIndex: number, gemIndexInHero: number) {
  const hero = world.heroes[heroIndex];
  if (!hero) return;
  hero.gems.splice(gemIndexInHero, 1);
}

export function skipDraft(world: World) {
  world.draftOffer = [];
  world.draftPickedIndex = -1;
}

export function usedBudget(world: World): number {
  let sum = 0;
  for (const h of world.heroes) sum += totalGemCost(h.gems);
  return sum;
}

export function setActiveHero(world: World, idx: number) {
  if (idx >= 0 && idx < world.heroes.length) world.activeHeroIndex = idx;
}

export const GAME_CONSTANTS = { HERO_RADIUS };
