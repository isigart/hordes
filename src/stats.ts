import type { Hero, Stats, StatKey, World } from "./types";

export function emptyStats(): Stats {
  return { STR: 0, AGI: 0, INT: 0, VIT: 0, DEX: 0, WIS: 0, END: 0, LCK: 0 };
}

export function cloneStats(s: Stats): Stats {
  return { ...s };
}

// Derived values from raw stats. One source of truth for the formulas.
export function derived(hero: Hero) {
  const s = hero.stats;
  return {
    physMult: 1 + 0.05 * s.STR,
    magicMult: 1 + 0.05 * s.INT,
    aspd: 1 + 0.04 * s.AGI,
    maxHp: hero.cls.baseHp + s.VIT * 8,
    hpRegen: 0.1 * s.VIT,
    critChance: Math.min(0.95, 0.05 + 0.01 * s.DEX),
    critDamage: 1.5 + 0.05 * s.LCK,
    cdr: Math.max(0.3, 1 - 0.03 * s.WIS),
    dmgReduction: Math.min(0.75, 0.02 * s.END),
    goldMult: 1 + 0.03 * s.LCK,
  };
}

export function xpForLevel(level: number): number {
  return Math.floor(10 + 5 * (level - 1) * level);
}

// Shared XP. When the team levels up, every living hero gets 3 stat points.
// Dead heroes still bank points for when they're revived.
export function gainXpShared(world: World, amount: number) {
  world.xp += amount;
  while (world.xp >= world.xpToNext) {
    world.xp -= world.xpToNext;
    world.level += 1;
    world.xpToNext = xpForLevel(world.level);
    for (const h of world.heroes) {
      h.level = world.level;
      h.unspentPoints += 3;
      const d = derived(h);
      h.maxHp = d.maxHp;
      // small heal on level up if alive
      if (h.hp > 0) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.2);
    }
  }
}

export function allocate(hero: Hero, key: StatKey): boolean {
  if (hero.unspentPoints <= 0) return false;
  hero.stats[key] += 1;
  hero.unspentPoints -= 1;
  const d = derived(hero);
  if (hero.hp > d.maxHp) hero.hp = d.maxHp;
  hero.maxHp = d.maxHp;
  return true;
}
