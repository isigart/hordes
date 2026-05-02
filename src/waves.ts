import type { World } from "./types";

// How many enemies to spawn over the course of a wave.
export function enemiesForWave(wave: number): number {
  return Math.round(20 + wave * 8 + Math.pow(wave, 1.4));
}

// Wave duration in ms.
export function waveDurationMs(wave: number): number {
  return 30_000 + Math.min(20_000, wave * 1500);
}

export function startWave(world: World, wave: number) {
  world.wave = wave;
  world.waveStartedAt = world.now;
  world.waveDurationMs = waveDurationMs(wave);
  world.enemiesToSpawn = enemiesForWave(wave);
  world.spawnAccumMs = 0;
  world.phase = "playing";
}
