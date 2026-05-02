import type { BuildProfile, Gem } from "./types";

// --- Gem catalog (v2) ---
// Cost system: [2] common, [3] solid, [4] strong.
// Each hero shares a global socketBudget pool.
// Gems are categorized for visual filtering.
//
// Skipped vs the full catalog:
//   - Miroir (reflect projectiles): no enemy projectiles yet.
//   - Tête Chercheuse (homing): projectile AI deferred to v3.
//   - Invocations (3 gems): need a minion system, deferred to v3.

export const GEMS: Gem[] = [
  // 🟢 SOIN
  { id: "lifeleech", name: "Sangsue", category: "soin", cost: 2,
    blurb: "3% des dégâts du porteur en HP",
    effects: [{ kind: "lifesteal", v: 0.03 }] },
  { id: "regen", name: "Régénération", category: "soin", cost: 2,
    blurb: "+1 HP/s passif (après 2s sans dégâts)",
    effects: [{ kind: "regen", v: 1, dmgCooldownMs: 2000 }] },
  { id: "firstaid", name: "Premiers Soins", category: "soin", cost: 3,
    blurb: "Soin +50% PV à HP < 30% (1×/run)",
    effects: [{ kind: "firstAid", threshold: 0.3, ratio: 0.5 }] },
  { id: "sanctuary", name: "Sanctuaire", category: "soin", cost: 3,
    blurb: "Pulse heal +5 PV rayon 250 toutes les 3s",
    effects: [{ kind: "sanctuary", heal: 5, radius: 250, intervalMs: 3000 }] },

  // 🔵 DÉFENSE
  { id: "taunt", name: "Taunt", category: "defense", cost: 2,
    blurb: "Tire l'aggro des mobs proches (rayon 180)",
    effects: [{ kind: "taunt", radius: 180 }] },
  { id: "lastbreath", name: "Dernier Souffle", category: "defense", cost: 3,
    blurb: "+50% dégâts si porteur à HP < 30%",
    effects: [{ kind: "lowHpDmg", threshold: 0.3, v: 0.5 }] },
  { id: "shield", name: "Bouclier", category: "defense", cost: 3,
    blurb: "+50 PV bouclier (regen 2/s)",
    effects: [{ kind: "shield", max: 50, regenPerSec: 2 }] },

  // 🔴 OFFENSIVE
  { id: "addeddmg", name: "Dégâts Augmentés", category: "offensive", cost: 3,
    blurb: "+40% dégâts",
    effects: [{ kind: "dmgMult", v: 1.4 }] },
  { id: "executioner", name: "Bourreau", category: "offensive", cost: 3,
    blurb: "×2 dmg vs ennemis HP < 25%",
    effects: [{ kind: "executioner", threshold: 0.25, v: 1.0 }] },
  { id: "critical", name: "Critique", category: "offensive", cost: 3,
    blurb: "+15% chance crit, +50% dmg crit",
    effects: [{ kind: "critChance", v: 0.15 }, { kind: "critDmg", v: 0.5 }] },
  { id: "predator", name: "Prédateur", category: "offensive", cost: 3,
    blurb: "+50% dmg vs ennemis HP > 90%",
    effects: [{ kind: "predator", threshold: 0.9, v: 0.5 }] },
  { id: "bloodlust", name: "Soif de Sang", category: "offensive", cost: 3,
    blurb: "Kill: +5%/stack dmg (max 50%, 4s)",
    effects: [{ kind: "bloodlust", perStack: 0.05, maxStacks: 10, durationMs: 4000 }] },
  { id: "fasteratk", name: "Attaques Rapides", category: "offensive", cost: 4,
    blurb: "−30% cooldown",
    effects: [{ kind: "cdMult", v: 0.7 }] },

  // 🟠 STATUTS
  { id: "ignite", name: "Embrasement", category: "statut", cost: 2,
    blurb: "Brûle 30% dmg/s pendant 3s",
    effects: [{ kind: "burn", dpsRatio: 0.3, duration: 3000 }] },
  { id: "poison", name: "Poison", category: "statut", cost: 2,
    blurb: "+1 stack poison/hit (5% dmg/s/stack, 4s)",
    effects: [{ kind: "poison", perStack: 0.05, duration: 4000, stacksPerHit: 1 }] },
  { id: "hex", name: "Hex", category: "statut", cost: 3,
    blurb: "Vuln 1s sur chaque hit (+50% dmg reçus)",
    effects: [{ kind: "hex", mult: 1.5, duration: 1000 }] },

  // 🟣 PATTERNS
  { id: "knockback", name: "Recul", category: "pattern", cost: 2,
    blurb: "+40 px de knockback/hit",
    effects: [{ kind: "knockback", v: 40 }] },
  { id: "morearea", name: "Plus d'Aire", category: "pattern", cost: 2,
    blurb: "+30% zone/portée",
    effects: [{ kind: "aoeMult", v: 1.3 }] },
  { id: "pierce", name: "Perçant", category: "pattern", cost: 2,
    blurb: "+1 pierce (projectiles)",
    effects: [{ kind: "pierce", v: 1 }] },
  { id: "chain", name: "Chaîne", category: "pattern", cost: 3,
    blurb: "+1 chain (50% dmg, 80px)",
    effects: [{ kind: "chain", count: 1, range: 80, falloff: 0.5 }] },
  { id: "multishot", name: "Multi-Tir", category: "pattern", cost: 4,
    blurb: "+1 projectile / +1 répétition AOE",
    effects: [{ kind: "multishot", extra: 1 }] },

  // 🟠 STATUTS bis (slow utility)
  { id: "frost", name: "Givre", category: "statut", cost: 2,
    blurb: "Ralentit −35% pendant 1.5s",
    effects: [{ kind: "slow", v: 0.35, duration: 1500 }] },

  // 🟡 UTILITÉ
  { id: "avarice", name: "Avarice", category: "utilite", cost: 2,
    blurb: "+20% or sur les kills du porteur",
    effects: [{ kind: "goldMult", v: 1.2 }] },

  // ⚫ INVOCATIONS — only useful on a Summoner. Logic in game.ts checks gem.id.
  { id: "armysize", name: "Taille d'Armée", category: "utilite", cost: 3,
    blurb: "+1 minion max (Summoner)",
    effects: [] },
  { id: "minionpower", name: "Puissance Minion", category: "utilite", cost: 4,
    blurb: "+50% PV et dégâts des minions (Summoner)",
    effects: [] },
  { id: "deathnova", name: "Nova de Mort", category: "utilite", cost: 4,
    blurb: "Explosion AOE 60px à la mort d'un minion (Summoner)",
    effects: [] },
];

export function emptyProfile(): BuildProfile {
  return {
    dmgMult: 1, cdMult: 1,
    critChanceBonus: 0, critDmgBonus: 0,
    lifesteal: 0,
    pierce: 0, chainCount: 0, chainRange: 0, chainFalloff: 0,
    multishot: 0, aoeMult: 1,
    burn: null, slow: null, poison: null, hex: null,
    knockback: 0,
    lowHpDmgBonus: 0, lowHpDmgThreshold: 0,
    executionerBonus: 0, executionerThreshold: 0,
    predatorBonus: 0, predatorThreshold: 0,
    regen: null, sanctuary: null, shield: null,
    firstAid: null, bloodlust: null,
    goldMult: 1,
    taunt: null,
  };
}

export function aggregateProfile(gems: Gem[]): BuildProfile {
  const p = emptyProfile();
  for (const g of gems) {
    for (const e of g.effects) {
      switch (e.kind) {
        case "dmgMult": p.dmgMult *= e.v; break;
        case "cdMult": p.cdMult *= e.v; break;
        case "aoeMult": p.aoeMult *= e.v; break;
        case "critChance": p.critChanceBonus += e.v; break;
        case "critDmg": p.critDmgBonus += e.v; break;
        case "lifesteal": p.lifesteal += e.v; break;
        case "pierce": p.pierce += e.v; break;
        case "multishot": p.multishot += e.extra; break;
        case "knockback": p.knockback += e.v; break;
        case "goldMult": p.goldMult *= e.v; break;
        case "chain":
          p.chainCount += e.count;
          p.chainRange = Math.max(p.chainRange, e.range);
          p.chainFalloff = e.falloff;
          break;
        case "burn":
          p.burn = p.burn
            ? { dpsRatio: p.burn.dpsRatio + e.dpsRatio,
                duration: Math.max(p.burn.duration, e.duration) }
            : { dpsRatio: e.dpsRatio, duration: e.duration };
          break;
        case "slow":
          p.slow = p.slow
            ? { v: Math.max(p.slow.v, e.v),
                duration: Math.max(p.slow.duration, e.duration) }
            : { v: e.v, duration: e.duration };
          break;
        case "poison":
          p.poison = p.poison
            ? { perStack: Math.max(p.poison.perStack, e.perStack),
                duration: Math.max(p.poison.duration, e.duration),
                stacksPerHit: p.poison.stacksPerHit + e.stacksPerHit }
            : { perStack: e.perStack, duration: e.duration, stacksPerHit: e.stacksPerHit };
          break;
        case "hex":
          p.hex = p.hex
            ? { mult: Math.max(p.hex.mult, e.mult),
                duration: Math.max(p.hex.duration, e.duration) }
            : { mult: e.mult, duration: e.duration };
          break;
        case "lowHpDmg":
          p.lowHpDmgBonus += e.v;
          p.lowHpDmgThreshold = Math.max(p.lowHpDmgThreshold, e.threshold);
          break;
        case "executioner":
          p.executionerBonus += e.v;
          p.executionerThreshold = Math.max(p.executionerThreshold, e.threshold);
          break;
        case "predator":
          p.predatorBonus += e.v;
          p.predatorThreshold = p.predatorThreshold === 0
            ? e.threshold : Math.min(p.predatorThreshold, e.threshold);
          break;
        case "regen":
          p.regen = p.regen
            ? { v: p.regen.v + e.v, dmgCooldownMs: Math.min(p.regen.dmgCooldownMs, e.dmgCooldownMs) }
            : { v: e.v, dmgCooldownMs: e.dmgCooldownMs };
          break;
        case "sanctuary":
          p.sanctuary = p.sanctuary
            ? { heal: p.sanctuary.heal + e.heal,
                radius: Math.max(p.sanctuary.radius, e.radius),
                intervalMs: Math.min(p.sanctuary.intervalMs, e.intervalMs) }
            : { heal: e.heal, radius: e.radius, intervalMs: e.intervalMs };
          break;
        case "shield":
          p.shield = p.shield
            ? { max: p.shield.max + e.max, regenPerSec: p.shield.regenPerSec + e.regenPerSec }
            : { max: e.max, regenPerSec: e.regenPerSec };
          break;
        case "firstAid":
          if (!p.firstAid || p.firstAid.ratio < e.ratio) {
            p.firstAid = { threshold: e.threshold, ratio: e.ratio };
          }
          break;
        case "bloodlust":
          p.bloodlust = p.bloodlust
            ? { perStack: p.bloodlust.perStack + e.perStack,
                maxStacks: Math.max(p.bloodlust.maxStacks, e.maxStacks),
                durationMs: Math.max(p.bloodlust.durationMs, e.durationMs) }
            : { perStack: e.perStack, maxStacks: e.maxStacks, durationMs: e.durationMs };
          break;
        case "taunt":
          p.taunt = p.taunt
            ? { radius: Math.max(p.taunt.radius, e.radius) }
            : { radius: e.radius };
          break;
      }
    }
  }
  return p;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Pick 3 distinct gems for the draft. Higher-cost gems become slightly more
// likely as waves go on, but always allow the basics.
export function pickDraftOffer(rng: () => number, wave: number): Gem[] {
  const weights = (g: Gem): number => {
    const w = 1 + Math.max(0, wave - g.cost) * 0.15;
    return Math.max(0.1, w);
  };
  const pool = shuffle(GEMS, rng);
  const offer: Gem[] = [];
  for (const g of pool) {
    if (offer.length >= 3) break;
    if (offer.some((o) => o.id === g.id)) continue;
    if (rng() < weights(g) / 3) offer.push(g);
  }
  // fallback fill if RNG was unkind
  for (const g of pool) {
    if (offer.length >= 3) break;
    if (!offer.some((o) => o.id === g.id)) offer.push(g);
  }
  return offer.slice(0, 3);
}

export function totalGemCost(gems: Gem[]): number {
  return gems.reduce((sum, g) => sum + g.cost, 0);
}
