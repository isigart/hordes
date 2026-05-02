// Talent trees — meta-progression. 12 nodes per hero on 3 axes (A / B / S).
// Each node costs 1 talent point; prereqs are linear within an axis.
// Effects either feed the BuildProfile pipeline (via gem effects) or expose a
// synergy flag that the engine reads at the relevant hook.

import type { Gem, GemEffect, Hero, HeroClassId, StatKey } from "./types";
import type { MetaProgress } from "./meta";

export type TalentEffect =
  | { kind: "gemEffect"; effect: GemEffect }
  | { kind: "statBonus"; stat: StatKey; value: number }
  | { kind: "synergy"; id: string }
  | { kind: "baseHpMult"; v: number }
  | { kind: "baseDmgMult"; v: number }
  | { kind: "baseRangeMult"; v: number };

export interface TalentNode {
  id: string;
  heroId: HeroClassId;
  axis: "A" | "B" | "S";
  row: number;        // 1..N within the axis
  blurb: string;
  effects: TalentEffect[];
  prereqs: string[];  // node ids that must be unlocked first
  capstone?: boolean; // visual flag for the final node of an axis
}

const node = (
  heroId: HeroClassId,
  axis: "A" | "B" | "S",
  row: number,
  blurb: string,
  effects: TalentEffect[],
  prereqs: string[] = [],
  capstone = false,
): TalentNode => ({
  id: `${heroId}_${axis}${row}`,
  heroId, axis, row, blurb, effects, prereqs, capstone,
});

// Convenience constructors
const ge = (effect: GemEffect): TalentEffect => ({ kind: "gemEffect", effect });
const stat = (k: StatKey, v: number): TalentEffect => ({ kind: "statBonus", stat: k, value: v });
const syn = (id: string): TalentEffect => ({ kind: "synergy", id });

// Linear prereq within an axis: An requires A(n-1).
const linear = (heroId: HeroClassId, axis: "A" | "B" | "S", row: number): string[] =>
  row > 1 ? [`${heroId}_${axis}${row - 1}`] : [];

// ============================================================================
// KNIGHT — Axis A: Tank · Axis B: DPS-CAC · Axis S: Synergie
// ============================================================================
const knightTree: TalentNode[] = [
  // Axis A — Tank
  node("knight", "A", 1, "+30% PV max", [{ kind: "baseHpMult", v: 1.3 }]),
  node("knight", "A", 2, "+10% réduction dégâts", [stat("END", 5)], linear("knight", "A", 2)),
  node("knight", "A", 3, "Régen +1.5/s", [stat("VIT", 15)], linear("knight", "A", 3)),
  node("knight", "A", 4, "Indestructible (cap.) — réd. dmg ×2 sous 25% PV",
       [syn("knight_indestructible")], linear("knight", "A", 4), true),
  // Axis B — DPS-CAC
  node("knight", "B", 1, "+25% dégâts mêlée", [ge({ kind: "dmgMult", v: 1.25 })]),
  node("knight", "B", 2, "+30% rayon AOE", [ge({ kind: "aoeMult", v: 1.3 })], linear("knight", "B", 2)),
  node("knight", "B", 3, "+20% chance crit", [stat("DEX", 20)], linear("knight", "B", 3)),
  node("knight", "B", 4, "Whirlwind (cap.) — 1 atk/4 hit 360°",
       [syn("knight_whirlwind")], linear("knight", "B", 4), true),
  // Axis S — Synergie
  node("knight", "S", 1, "Guardian — 20% dmg alliés redirigé sur Knight",
       [syn("knight_guardian")]),
  node("knight", "S", 2, "Holy Strike — soigné = next atk +50%",
       [syn("knight_holystrike")], linear("knight", "S", 2)),
  node("knight", "S", 3, "Resolve — allié tombe = +30% dmg 5s",
       [syn("knight_resolve")], linear("knight", "S", 3)),
  node("knight", "S", 4, "Avatar (cap.) — survit dégât léthal à 1 PV (1×/run)",
       [syn("knight_avatar")], linear("knight", "S", 4), true),
];

// ============================================================================
// HEALER — Axis A: Buffer · Axis B: Debuffer · Axis S: Synergie
// ============================================================================
const healerTree: TalentNode[] = [
  // Axis A — Buffer
  node("healer", "A", 1, "Soins +30% potency", [syn("healer_buffheal")]),
  node("healer", "A", 2, "Soigné = +20% dmg pendant 3s", [syn("healer_powerheal")], linear("healer", "A", 2)),
  node("healer", "A", 3, "Soin restaure aussi 20% en bouclier", [syn("healer_shieldheal")], linear("healer", "A", 3)),
  node("healer", "A", 4, "Pulse (cap.) — soin devient AOE autour de la cible",
       [syn("healer_pulseheal")], linear("healer", "A", 4), true),
  // Axis B — Debuffer
  node("healer", "B", 1, "Attaques debuff cible (+20% dmg reçus 2s)", [syn("healer_vulnatk")]),
  node("healer", "B", 2, "Plague — chaque hit stacke +5% vuln", [syn("healer_plague")], linear("healer", "B", 2)),
  node("healer", "B", 3, "Wither — debuffés ralentis −30%", [syn("healer_wither")], linear("healer", "B", 3)),
  node("healer", "B", 4, "Mass Curse (cap.) — AOE debuff toutes 5s",
       [syn("healer_masscurse")], linear("healer", "B", 4), true),
  // Axis S — Synergie
  node("healer", "S", 1, "Necro Heal — peut cibler les minions", [syn("healer_necroheal")]),
  node("healer", "S", 2, "Lifebond — sa régen affecte toute l'équipe", [syn("healer_lifebond")], linear("healer", "S", 2)),
  node("healer", "S", 3, "Phoenix — revive 1× allié à 30% PV (1×/run)", [syn("healer_phoenix")], linear("healer", "S", 3)),
  node("healer", "S", 4, "Saint (cap.) — pulse heal team toutes 5s",
       [syn("healer_saint")], linear("healer", "S", 4), true),
];

// ============================================================================
// SUMMONER — Axis A: Horde · Axis B: Champion · Axis S: Synergie
// ============================================================================
const summonerTree: TalentNode[] = [
  // Axis A — Horde
  node("summoner", "A", 1, "+1 minion max", [syn("summoner_armysize1")]),
  node("summoner", "A", 2, "Cooldown summon −25%", [syn("summoner_summoncd")], linear("summoner", "A", 2)),
  node("summoner", "A", 3, "+1 minion max", [syn("summoner_armysize2")], linear("summoner", "A", 3)),
  node("summoner", "A", 4, "Death Surge (cap.) — mort minion réduit CD 50%",
       [syn("summoner_deathsurge")], linear("summoner", "A", 4), true),
  // Axis B — Champion
  node("summoner", "B", 1, "Champion — max 1 minion mais ×3 stats", [syn("summoner_champion")]),
  node("summoner", "B", 2, "Champion AOE attack rayon 30", [syn("summoner_champion_aoe")], linear("summoner", "B", 2)),
  node("summoner", "B", 3, "Champion régen +5/s", [syn("summoner_champion_regen")], linear("summoner", "B", 3)),
  node("summoner", "B", 4, "Champion Phoenix (cap.) — respawn 1×/run",
       [syn("summoner_champion_phoenix")], linear("summoner", "B", 4), true),
  // Axis S — Synergie
  node("summoner", "S", 1, "Spirit Link — allié mort = esprit avec 80% stats",
       [syn("summoner_spiritlink")]),
  node("summoner", "S", 2, "Reanimate — ennemi tué a 10% chance → minion 10s",
       [syn("summoner_reanimate")], linear("summoner", "S", 2)),
  node("summoner", "S", 3, "Soul Harvest — mort minion = +5%/stack dmg 5s",
       [syn("summoner_soulharvest")], linear("summoner", "S", 3)),
  node("summoner", "S", 4, "Necropolis (cap.) — 5 minions gratuits au start",
       [syn("summoner_necropolis")], linear("summoner", "S", 4), true),
];

// ============================================================================
// ARCHER — Axis A: Multishot · Axis B: Sniper · Axis S: Synergie
// ============================================================================
const archerTree: TalentNode[] = [
  // Axis A — Multishot
  node("archer", "A", 1, "+1 projectile baseline",
       [ge({ kind: "multishot", extra: 1 })]),
  node("archer", "A", 2, "Pierce +1", [ge({ kind: "pierce", v: 1 })], linear("archer", "A", 2)),
  node("archer", "A", 3, "+1 projectile baseline",
       [ge({ kind: "multishot", extra: 1 })], linear("archer", "A", 3)),
  node("archer", "A", 4, "Volley (cap.) — +2 projectiles, spread serré",
       [ge({ kind: "multishot", extra: 2 }), syn("archer_volleycap")], linear("archer", "A", 4), true),
  // Axis B — Sniper
  node("archer", "B", 1, "+50% portée", [{ kind: "baseRangeMult", v: 1.5 }]),
  node("archer", "B", 2, "+30% dégâts", [ge({ kind: "dmgMult", v: 1.3 })], linear("archer", "B", 2)),
  node("archer", "B", 3, "Premier tir sur un ennemi +50%", [syn("archer_firstshot")], linear("archer", "B", 3)),
  node("archer", "B", 4, "Master Sniper (cap.) — pierce illimité, 70% dmg/cible",
       [syn("archer_mastersniper")], linear("archer", "B", 4), true),
  // Axis S — Synergie
  node("archer", "S", 1, "Marksman — zones de feu Mage enflame flèches +30% burn",
       [syn("archer_marksman")]),
  node("archer", "S", 2, "Coordinated — Healer atk = next Archer +50%",
       [syn("archer_coordinated")], linear("archer", "S", 2)),
  node("archer", "S", 3, "Steady Aim — toujours +20% dmg (immobile)",
       [ge({ kind: "dmgMult", v: 1.20 }), syn("archer_steady")], linear("archer", "S", 3)),
  node("archer", "S", 4, "Apex Predator (cap.) — boss prennent +50%",
       [syn("archer_apex")], linear("archer", "S", 4), true),
];

// ============================================================================
// MAGE — Axis A: Zone · Axis B: Mono · Axis S: Synergie
// ============================================================================
const mageTree: TalentNode[] = [
  // Axis A — Zone
  node("mage", "A", 1, "+30% rayon AOE", [ge({ kind: "aoeMult", v: 1.3 })]),
  node("mage", "A", 2, "Zones de feu lingering 3s", [syn("mage_firezone")], linear("mage", "A", 2)),
  node("mage", "A", 3, "+30% rayon AOE", [ge({ kind: "aoeMult", v: 1.3 })], linear("mage", "A", 3)),
  node("mage", "A", 4, "Inferno (cap.) — 1 cast/3 double-size + burn boost",
       [syn("mage_inferno")], linear("mage", "A", 4), true),
  // Axis B — Mono
  node("mage", "B", 1, "Convert — projectile single-target +100% dmg",
       [syn("mage_mono"), ge({ kind: "dmgMult", v: 2.0 })]),
  node("mage", "B", 2, "+50% portée", [{ kind: "baseRangeMult", v: 1.5 }], linear("mage", "B", 2)),
  node("mage", "B", 3, "Pierce", [ge({ kind: "pierce", v: 2 })], linear("mage", "B", 3)),
  node("mage", "B", 4, "Annihilate (cap.) — kill < 30% PV refund cooldown",
       [syn("mage_annihilate")], linear("mage", "B", 4), true),
  // Axis S — Synergie
  node("mage", "S", 1, "Pyromancy — zones enflame projectiles alliés qui passent +30% burn",
       [syn("mage_pyromancy")]),
  node("mage", "S", 2, "Soul Burn — minion mort proche = next cast +20%",
       [syn("mage_soulburn")], linear("mage", "S", 2)),
  node("mage", "S", 3, "Echo — 10% sort répété gratuit",
       [syn("mage_echo")], linear("mage", "S", 3)),
  node("mage", "S", 4, "Apocalypse (cap.) — 1 cast/10 = AOE 200px",
       [syn("mage_apocalypse")], linear("mage", "S", 4), true),
];

export const TREES: Record<HeroClassId, TalentNode[]> = {
  knight: knightTree,
  healer: healerTree,
  summoner: summonerTree,
  archer: archerTree,
  mage: mageTree,
};

export function getTreeNode(heroId: HeroClassId, nodeId: string): TalentNode | undefined {
  return TREES[heroId]?.find((n) => n.id === nodeId);
}

export function arePrereqsMet(
  heroId: HeroClassId,
  nodeId: string,
  unlocked: string[],
): boolean {
  const node = getTreeNode(heroId, nodeId);
  if (!node) return false;
  return node.prereqs.every((id) => unlocked.includes(id));
}

// Apply ONE talent node's effects to a live hero (called in draft phase
// when the player invests a new point mid-run). Does NOT support undoing.
export function applyNodeToHero(hero: Hero, node: TalentNode) {
  let talentGem = hero.gems.find((g) => g.id === "_talent");
  for (const e of node.effects) {
    switch (e.kind) {
      case "gemEffect":
        if (!talentGem) {
          talentGem = {
            id: "_talent", name: "Talents", blurb: "Bonus talents",
            category: "utilite", cost: 0, effects: [],
          };
          hero.gems.unshift(talentGem);
        }
        talentGem.effects.push(e.effect);
        break;
      case "statBonus":
        hero.stats[e.stat] += e.value;
        break;
      case "synergy":
        hero.synergies.add(e.id);
        break;
      case "baseHpMult":
        hero.cls = { ...hero.cls, baseHp: Math.round(hero.cls.baseHp * e.v) };
        // bump maxHp + hp by the same ratio so player feels the buff instantly
        hero.maxHp = Math.round(hero.maxHp * e.v);
        hero.hp = Math.min(hero.maxHp, Math.round(hero.hp * e.v));
        break;
      case "baseDmgMult":
        hero.cls = { ...hero.cls, baseDamage: hero.cls.baseDamage * e.v };
        break;
      case "baseRangeMult":
        hero.cls = { ...hero.cls, attackRange: hero.cls.attackRange * e.v };
        break;
    }
  }
}

// Build a "virtual gem" carrying all gemEffect-style talents, plus apply
// statBonus / baseHp/Dmg/Range mults directly to the hero. Synergy ids land
// in hero.synergies for the engine to read.
export function applyTalentsToHero(hero: Hero, meta: MetaProgress) {
  const ids = meta.unlockedNodes[hero.cls.id] ?? [];
  const gemEffects: GemEffect[] = [];
  let hpMult = 1, dmgMult = 1, rangeMult = 1;
  for (const id of ids) {
    const tn = getTreeNode(hero.cls.id, id);
    if (!tn) continue;
    for (const e of tn.effects) {
      switch (e.kind) {
        case "gemEffect":   gemEffects.push(e.effect); break;
        case "statBonus":   hero.stats[e.stat] += e.value; break;
        case "synergy":     hero.synergies.add(e.id); break;
        case "baseHpMult":  hpMult *= e.v; break;
        case "baseDmgMult": dmgMult *= e.v; break;
        case "baseRangeMult": rangeMult *= e.v; break;
      }
    }
  }
  // Mutate the cls instance for this hero so base stats reflect talents.
  // We deep-copy first to avoid leaking changes across spawns / runs.
  const clsCopy = { ...hero.cls };
  if (hpMult !== 1)    clsCopy.baseHp = Math.round(clsCopy.baseHp * hpMult);
  if (dmgMult !== 1)   clsCopy.baseDamage = clsCopy.baseDamage * dmgMult;
  if (rangeMult !== 1) clsCopy.attackRange = clsCopy.attackRange * rangeMult;
  hero.cls = clsCopy;
  hero.maxHp = clsCopy.baseHp;
  hero.hp = clsCopy.baseHp;

  if (gemEffects.length > 0) {
    const talentGem: Gem = {
      id: "_talent",
      name: "Talents",
      blurb: "Bonus talents",
      category: "utilite",
      cost: 0,
      effects: gemEffects,
    };
    hero.gems.unshift(talentGem);
  }
}

