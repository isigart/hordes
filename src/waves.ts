import type { World } from "./types";

// 100-wave campaign + endless mode after.
// Curve targets:
//   wave 1   →  ~20    (sparse, you count individuals)
//   wave 10  →  ~95    (busy)
//   wave 25  →  ~270   (intense)
//   wave 50  →  ~685   (mur descendant)
//   wave 75  →  ~1295
//   wave 100 →  ~2000  (climax campaign)
//   wave 150 →  ~3690  (endless)
//   wave 200 →  ~5715
export function enemiesForWave(wave: number): number {
  return Math.round(15 + wave * 4 + Math.pow(wave, 1.55));
}

// Wave duration ramps to 60s by ~wave 30 then plateaus, so the spawn rate
// stays readable while density climbs.
export function waveDurationMs(wave: number): number {
  return Math.min(60_000, 25_000 + wave * 1200);
}

export const CAMPAIGN_WAVES = 100;
export function isEndless(wave: number): boolean {
  return wave > CAMPAIGN_WAVES;
}

export function startWave(world: World, wave: number) {
  world.wave = wave;
  world.waveStartedAt = world.now;
  world.waveDurationMs = waveDurationMs(wave);
  world.enemiesToSpawn = enemiesForWave(wave);
  world.spawnAccumMs = 0;
  world.phase = "playing";
}
