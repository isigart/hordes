import type { Hero, HeroClass, HeroClassId, Stats, Vec2 } from "./types";
import type { MetaProgress } from "./meta";
import { derived } from "./stats";
import { applyTalentsToHero } from "./talents";

const baseStats = (
  STR: number, AGI: number, INT: number, VIT: number,
  DEX: number, WIS: number, END: number, LCK: number,
): Stats => ({ STR, AGI, INT, VIT, DEX, WIS, END, LCK });

export const HERO_CLASSES: Record<HeroClassId, HeroClass> = {
  knight: {
    id: "knight",
    name: "Chevalier",
    blurb: "Tank. AOE mêlée large. Tient l'apex.",
    baseStats: baseStats(5, 2, 0, 6, 1, 1, 5, 1),
    baseHp: 130,
    baseDamage: 8,
    attackRange: 60,
    attackCooldownMs: 800,
    color: "#f5c542",
    attackKind: "melee_aoe",
    aoeRadius: 56,
  },
  archer: {
    id: "archer",
    name: "Archer",
    blurb: "Distance. Tirs rapides single-target. Crit.",
    baseStats: baseStats(2, 5, 1, 3, 4, 2, 1, 2),
    baseHp: 75,
    baseDamage: 6,
    attackRange: 320,
    attackCooldownMs: 480,
    color: "#6fd97f",
    attackKind: "ranged_single",
    projectileSpeed: 540,
  },
  healer: {
    id: "healer",
    name: "Healer",
    blurb: "Support. Chaque attaque soigne l'allié le plus blessé.",
    baseStats: baseStats(1, 2, 3, 4, 1, 5, 2, 2),
    baseHp: 80,
    baseDamage: 4,
    attackRange: 240,
    attackCooldownMs: 600,
    color: "#f5e8c0",
    attackKind: "ranged_single",
    projectileSpeed: 460,
  },
  mage: {
    id: "mage",
    name: "Mage",
    blurb: "Distance AOE. Boules de feu. Wave clear.",
    baseStats: baseStats(0, 1, 6, 3, 2, 4, 1, 2),
    baseHp: 65,
    baseDamage: 5,
    attackRange: 280,
    attackCooldownMs: 1100,
    color: "#b06fd9",
    attackKind: "ranged_aoe",
    projectileSpeed: 360,
    aoeRadius: 60,
  },
  summoner: {
    id: "summoner",
    name: "Summoner",
    blurb: "Invoque des squelettes. Faibles dégâts directs, gros via minions.",
    baseStats: baseStats(0, 1, 5, 3, 1, 5, 2, 2),
    baseHp: 70,
    baseDamage: 3,
    attackRange: 220,
    attackCooldownMs: 700,
    color: "#7f4f9a",
    attackKind: "ranged_single",
    projectileSpeed: 360,
  },
};

// Pyramid formation pointing up:
//                [Knight]                  apex (closest to spawn)
//          [Paladin]   [Rogue]             middle melee
//         [Archer]      [Mage]             back-line ranged
//
// Positions are relative to the arena dimensions (computed at spawn time).
// Snap to a 10px grid so each hero aligns cleanly inside its 10x10 zone.
const snap = (v: number) => Math.round(v / 10) * 10;

export function teamFormation(arenaW: number, arenaH: number): Vec2[] {
  const cx = snap(arenaW / 2);
  const apex = snap(arenaH * 0.55);
  const mid = snap(arenaH * 0.70);
  const base = snap(arenaH * 0.85);
  return [
    { x: cx,        y: apex },         // 0: knight (apex)
    { x: cx - 60,   y: mid  },         // 1: healer
    { x: cx + 60,   y: mid  },         // 2: summoner
    { x: cx - 90,   y: base },         // 3: archer
    { x: cx + 90,   y: base },         // 4: mage
  ];
}

// Formation order (by heroIndex):
//   0 apex      → Knight (tank, takes the brunt)
//   1 mid-left  → Healer (close to Knight to keep him up)
//   2 mid-right → Summoner (mid so minions spawn forward into the fight)
//   3 back-left → Archer (safe ranged DPS)
//   4 back-right→ Mage (safe ranged AOE)
export const TEAM_ORDER: HeroClassId[] = ["knight", "healer", "summoner", "archer", "mage"];

export function spawnHeroAt(cls: HeroClass, pos: Vec2, index: number): Hero {
  const hero: Hero = {
    cls,
    heroIndex: index,
    pos: { x: pos.x, y: pos.y },
    hp: cls.baseHp,
    maxHp: cls.baseHp,
    level: 1,
    unspentPoints: 0,
    stats: { ...cls.baseStats },
    lastAttackAt: 0,
    facing: -Math.PI / 2, // facing up by default
    gems: [],
    shieldHp: 0,
    lastDamageAt: -1e9,
    firstAidUsed: false,
    bloodlustStacks: 0,
    bloodlustExpiresAt: 0,
    sanctuaryNextAt: 0,
    pendingMultishots: [],
    lastSummonAt: 0,
    synergies: new Set<string>(),
    enemyHitMemory: new Set(),
    phoenixUsed: false,
    avatarUsed: false,
    attackCounter: 0,
  };
  const d = derived(hero);
  hero.maxHp = d.maxHp;
  hero.hp = hero.maxHp;
  return hero;
}

export function spawnTeam(arenaW: number, arenaH: number, meta: MetaProgress): Hero[] {
  const positions = teamFormation(arenaW, arenaH);
  return TEAM_ORDER.map((id, i) => {
    const hero = spawnHeroAt(HERO_CLASSES[id], positions[i], i);
    applyTalentsToHero(hero, meta);
    // recompute max HP after talents may have changed VIT or baseHp
    const d = derived(hero);
    hero.maxHp = d.maxHp;
    hero.hp = hero.maxHp;
    return hero;
  });
}
