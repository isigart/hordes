// 10 biomes for the 100-wave campaign. Each owns a 10-wave segment.
// The 10th wave of each biome (10, 20, 30, ...) is a BOSS wave.
// In endless mode (wave > 100), biomes cycle.

export type FormationKind =
  | "top_random"   // single mobs, random x, top edge
  | "top_cluster"  // bursts of 5 at random x
  | "top_wave"     // synchronized rows of 10
  | "multi_dir";   // top + left + right edges

export type BiomeMechanic =
  | "none"        // standard movement and contact damage
  | "pack"        // faster when allies are nearby
  | "poison"      // applies stacking poison on contact
  | "charge"      // straight-line dash, ignores slow
  | "ambush"      // spawns near the team, not at the top edge
  | "chill"       // slows hero attack speed on contact
  | "burst"       // explodes on death (AOE damage to heroes)
  | "revive"      // chance to come back after death
  | "phase"       // periodic damage immunity
  | "void";       // mix of phase + burst (final biome)

export interface BiomePalette {
  grunt: string;
  rusher: string;
  tank: string;
  elite: string;
  boss: string;
}

export interface BiomeConfig {
  id: string;
  name: string;
  startWave: number;
  endWave: number;
  palette: BiomePalette;
  formation: FormationKind;
  mechanic: BiomeMechanic;
  // boss is "elite-like" with these multipliers applied to a base elite
  boss: {
    hpMult: number;
    dmgMult: number;
    speedMult: number;
    radius: number;
  };
  description: string;
  // very subtle bg tint for visual identity
  bgTint: string;
}

export const BIOMES: BiomeConfig[] = [
  {
    id: "plain",
    name: "Plaine",
    startWave: 1,
    endWave: 10,
    palette: { grunt: "#d94f4f", rusher: "#d9954f", tank: "#9a4fd9", elite: "#f5c542", boss: "#ff7a3d" },
    formation: "top_random",
    mechanic: "none",
    boss: { hpMult: 12, dmgMult: 2.5, speedMult: 0.75, radius: 4.5 },
    description: "Soldats. Approche directe.",
    bgTint: "rgba(20, 16, 12, 0.0)",
  },
  {
    id: "forest",
    name: "Forêt",
    startWave: 11,
    endWave: 20,
    palette: { grunt: "#6f9a4f", rusher: "#9ad94f", tank: "#4f7a4f", elite: "#d9d44f", boss: "#7fd94f" },
    formation: "top_cluster",
    mechanic: "pack",
    boss: { hpMult: 14, dmgMult: 2.5, speedMult: 0.85, radius: 5 },
    description: "Meutes. Plus rapides ensemble.",
    bgTint: "rgba(12, 22, 14, 0.18)",
  },
  {
    id: "swamp",
    name: "Marécage",
    startWave: 21,
    endWave: 30,
    palette: { grunt: "#7a9a4f", rusher: "#a08c4f", tank: "#4f5a7a", elite: "#d9d4a0", boss: "#9ad97f" },
    formation: "top_wave",
    mechanic: "poison",
    boss: { hpMult: 16, dmgMult: 2.0, speedMult: 0.7, radius: 5 },
    description: "Lents mais empoisonnés. DoT au contact.",
    bgTint: "rgba(20, 28, 14, 0.25)",
  },
  {
    id: "desert",
    name: "Désert",
    startWave: 31,
    endWave: 40,
    palette: { grunt: "#d9b04f", rusher: "#e8c98a", tank: "#a07a4f", elite: "#f5e0a0", boss: "#ff9020" },
    formation: "top_wave",
    mechanic: "charge",
    boss: { hpMult: 14, dmgMult: 3.0, speedMult: 1.2, radius: 5 },
    description: "Charges synchronisées. Vitesse linéaire.",
    bgTint: "rgba(36, 30, 18, 0.22)",
  },
  {
    id: "caves",
    name: "Cavernes",
    startWave: 41,
    endWave: 50,
    palette: { grunt: "#6f6f7a", rusher: "#9a9aa0", tank: "#4f4f5a", elite: "#d8d8e2", boss: "#b06fd9" },
    formation: "multi_dir",
    mechanic: "ambush",
    boss: { hpMult: 18, dmgMult: 2.5, speedMult: 0.6, radius: 6 },
    description: "Embuscades. Spawn par les côtés.",
    bgTint: "rgba(20, 18, 26, 0.30)",
  },
  {
    id: "frost",
    name: "Glacier",
    startWave: 51,
    endWave: 60,
    palette: { grunt: "#7fc9d9", rusher: "#b0d9d9", tank: "#5fcfd9", elite: "#d8e8f5", boss: "#5fa0d9" },
    formation: "top_cluster",
    mechanic: "chill",
    boss: { hpMult: 18, dmgMult: 2.5, speedMult: 0.7, radius: 6 },
    description: "Givre. Ralentit les héros au contact.",
    bgTint: "rgba(14, 24, 32, 0.26)",
  },
  {
    id: "volcano",
    name: "Volcan",
    startWave: 61,
    endWave: 70,
    palette: { grunt: "#d96f4f", rusher: "#ff7a3d", tank: "#a04f4f", elite: "#ff9020", boss: "#ff4020" },
    formation: "top_wave",
    mechanic: "burst",
    boss: { hpMult: 20, dmgMult: 3.0, speedMult: 0.8, radius: 6 },
    description: "Explosion à la mort. AOE dégâts héros.",
    bgTint: "rgba(34, 16, 14, 0.30)",
  },
  {
    id: "crypt",
    name: "Crypte",
    startWave: 71,
    endWave: 80,
    palette: { grunt: "#9a7a9a", rusher: "#b08ca0", tank: "#5a4f6a", elite: "#d8c8e2", boss: "#a04fd9" },
    formation: "multi_dir",
    mechanic: "revive",
    boss: { hpMult: 22, dmgMult: 2.5, speedMult: 0.7, radius: 6 },
    description: "Mort-vivants. 30% de chance de revive.",
    bgTint: "rgba(22, 18, 28, 0.32)",
  },
  {
    id: "astral",
    name: "Astral",
    startWave: 81,
    endWave: 90,
    palette: { grunt: "#6f9ad9", rusher: "#a0bfff", tank: "#4f7ad9", elite: "#d8e0ff", boss: "#7fa0ff" },
    formation: "top_cluster",
    mechanic: "phase",
    boss: { hpMult: 22, dmgMult: 3.0, speedMult: 0.8, radius: 6 },
    description: "Phasing. Immunité périodique.",
    bgTint: "rgba(16, 22, 38, 0.28)",
  },
  {
    id: "void",
    name: "Abysse",
    startWave: 91,
    endWave: 100,
    palette: { grunt: "#d94f9a", rusher: "#ff5fb0", tank: "#7a4f6a", elite: "#ff90d9", boss: "#ff209a" },
    formation: "multi_dir",
    mechanic: "void",
    boss: { hpMult: 30, dmgMult: 4.0, speedMult: 0.9, radius: 8 },
    description: "Climax. Phase + explosion. Tout, partout.",
    bgTint: "rgba(34, 14, 28, 0.36)",
  },
];

export function getBiome(wave: number): BiomeConfig {
  if (wave < 1) return BIOMES[0];
  for (const b of BIOMES) {
    if (wave >= b.startWave && wave <= b.endWave) return b;
  }
  // endless: cycle through biomes from forest onward, skipping the tutorial plain
  const cycle = BIOMES.slice(1);
  const idx = Math.max(0, ((wave - 101) / 10) | 0);
  return cycle[idx % cycle.length] ?? BIOMES[BIOMES.length - 1];
}

export function isBossWave(wave: number): boolean {
  return wave % 10 === 0;
}
