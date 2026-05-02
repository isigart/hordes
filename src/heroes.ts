import type { Hero, HeroClass, HeroClassId, Stats } from "./types";
import { derived, xpForLevel } from "./stats";

const baseStats = (
  STR: number, AGI: number, INT: number, VIT: number,
  DEX: number, WIS: number, END: number, LCK: number,
): Stats => ({ STR, AGI, INT, VIT, DEX, WIS, END, LCK });

export const HERO_CLASSES: Record<HeroClassId, HeroClass> = {
  knight: {
    id: "knight",
    name: "Knight",
    blurb: "Mêlée. AOE en cercle. Encaisse.",
    baseStats: baseStats(5, 2, 0, 5, 1, 1, 4, 1),
    baseHp: 100,
    baseDamage: 8,
    attackRange: 56,
    attackCooldownMs: 750,
    color: "#f5c542",
    attackKind: "melee_aoe",
    aoeRadius: 56,
  },
  archer: {
    id: "archer",
    name: "Archer",
    blurb: "Distance. Tirs rapides single-target. Crit.",
    baseStats: baseStats(2, 5, 1, 3, 4, 2, 1, 2),
    baseHp: 70,
    baseDamage: 6,
    attackRange: 280,
    attackCooldownMs: 500,
    color: "#6fd97f",
    attackKind: "ranged_single",
    projectileSpeed: 520,
  },
  mage: {
    id: "mage",
    name: "Mage",
    blurb: "Distance. Boules de feu AOE. Scaling INT.",
    baseStats: baseStats(0, 1, 6, 3, 2, 4, 1, 2),
    baseHp: 65,
    baseDamage: 5,
    attackRange: 240,
    attackCooldownMs: 1100,
    color: "#b06fd9",
    attackKind: "ranged_aoe",
    projectileSpeed: 360,
    aoeRadius: 60,
  },
};

export function spawnHero(cls: HeroClass, x: number, y: number): Hero {
  const hero: Hero = {
    cls,
    pos: { x, y },
    hp: cls.baseHp,
    maxHp: cls.baseHp,
    level: 1,
    xp: 0,
    xpToNext: xpForLevel(1),
    unspentPoints: 0,
    stats: { ...cls.baseStats },
    lastAttackAt: 0,
    facing: 0,
    gold: 0,
  };
  const d = derived(hero);
  hero.maxHp = d.maxHp;
  hero.hp = hero.maxHp;
  return hero;
}
