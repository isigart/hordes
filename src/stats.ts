import type { Hero, Stats, StatKey } from "./types";

export function emptyStats(): Stats {
  return { STR: 0, AGI: 0, INT: 0, VIT: 0, DEX: 0, WIS: 0, END: 0, LCK: 0 };
}

export function cloneStats(s: Stats): Stats {
  return { ...s };
}

// Derived values from raw stats. Keep formulas in one place for transparency.
export function derived(hero: Hero) {
  const s = hero.stats;
  return {
    // damage multiplier on physical attacks: 1 + 5% per STR
    physMult: 1 + 0.05 * s.STR,
    // skill/magic damage multiplier
    magicMult: 1 + 0.05 * s.INT,
    // attack speed multiplier: cooldown is divided by this
    aspd: 1 + 0.04 * s.AGI,
    // max HP grows with VIT
    maxHp: hero.cls.baseHp + s.VIT * 8,
    // HP regen per second
    hpRegen: 0.1 * s.VIT,
    // crit chance: 5% base + 1% per DEX, capped at 95%
    critChance: Math.min(0.95, 0.05 + 0.01 * s.DEX),
    // crit damage: 150% base + 5% per LCK
    critDamage: 1.5 + 0.05 * s.LCK,
    // cooldown reduction (multiplier on cooldown, capped at 70%)
    cdr: Math.max(0.3, 1 - 0.03 * s.WIS),
    // damage reduction (flat % off incoming, capped at 75%)
    dmgReduction: Math.min(0.75, 0.02 * s.END),
    // gold multiplier
    goldMult: 1 + 0.03 * s.LCK,
  };
}

export function xpForLevel(level: number): number {
  // gentle curve: 10, 25, 45, 70, 100, ...
  return Math.floor(10 + 5 * (level - 1) * level);
}

export function gainXp(hero: Hero, amount: number) {
  hero.xp += amount;
  while (hero.xp >= hero.xpToNext) {
    hero.xp -= hero.xpToNext;
    hero.level += 1;
    hero.unspentPoints += 3; // 3 stat points per level
    hero.xpToNext = xpForLevel(hero.level);
    // level up heals 25% of max
    const d = derived(hero);
    hero.hp = Math.min(d.maxHp, hero.hp + d.maxHp * 0.25);
  }
}

export function allocate(hero: Hero, key: StatKey): boolean {
  if (hero.unspentPoints <= 0) return false;
  hero.stats[key] += 1;
  hero.unspentPoints -= 1;
  // refresh max HP cap if VIT was raised, but don't auto-heal
  const d = derived(hero);
  if (hero.hp > d.maxHp) hero.hp = d.maxHp;
  hero.maxHp = d.maxHp;
  return true;
}
