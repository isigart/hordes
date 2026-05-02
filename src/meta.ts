// Persistent meta-progression. Survives across runs via localStorage.
// Each FIRST-time wave clear awards 1 talent point (lifetime).
// Talent points are a shared pool spent across the 5 hero trees.

import type { HeroClassId } from "./types";

const STORAGE_KEY = "hordes-meta-v1";

export interface MetaProgress {
  highestWaveReached: number;
  earnedPoints: number;
  spentPoints: number;
  unlockedNodes: Record<HeroClassId, string[]>;
  respecsUsedThisCycle: number;
}

export function emptyMeta(): MetaProgress {
  return {
    highestWaveReached: 0,
    earnedPoints: 0,
    spentPoints: 0,
    unlockedNodes: {
      knight: [], healer: [], summoner: [], archer: [], mage: [],
    },
    respecsUsedThisCycle: 0,
  };
}

export function loadMeta(): MetaProgress {
  if (typeof localStorage === "undefined") return emptyMeta();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyMeta();
    const parsed = JSON.parse(raw) as Partial<MetaProgress>;
    const base = emptyMeta();
    return {
      highestWaveReached: parsed.highestWaveReached ?? 0,
      earnedPoints: parsed.earnedPoints ?? 0,
      spentPoints: parsed.spentPoints ?? 0,
      unlockedNodes: { ...base.unlockedNodes, ...(parsed.unlockedNodes ?? {}) },
      respecsUsedThisCycle: parsed.respecsUsedThisCycle ?? 0,
    };
  } catch {
    return emptyMeta();
  }
}

export function saveMeta(meta: MetaProgress) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  } catch { /* quota or privacy mode */ }
}

export function availablePoints(meta: MetaProgress): number {
  return Math.max(0, meta.earnedPoints - meta.spentPoints);
}

// Returns true if a NEW point was awarded (first time clearing this wave).
export function awardWaveClearPoint(meta: MetaProgress, wave: number): boolean {
  if (wave > meta.highestWaveReached) {
    meta.highestWaveReached = wave;
    meta.earnedPoints += 1;
    saveMeta(meta);
    return true;
  }
  return false;
}

export function isUnlocked(meta: MetaProgress, heroId: HeroClassId, nodeId: string): boolean {
  const list = meta.unlockedNodes[heroId];
  return list ? list.includes(nodeId) : false;
}

export function unlockNode(meta: MetaProgress, heroId: HeroClassId, nodeId: string): boolean {
  if (availablePoints(meta) <= 0) return false;
  const list = meta.unlockedNodes[heroId];
  if (!list) return false;
  if (list.includes(nodeId)) return false;
  list.push(nodeId);
  meta.spentPoints += 1;
  saveMeta(meta);
  return true;
}

// Free first respec per cycle, otherwise -10% of total spent points.
export function respecAll(meta: MetaProgress): { lostPoints: number; wasFree: boolean } {
  const wasFree = meta.respecsUsedThisCycle === 0;
  const lostPoints = wasFree ? 0 : Math.ceil(meta.spentPoints * 0.1);
  for (const id of Object.keys(meta.unlockedNodes) as HeroClassId[]) {
    meta.unlockedNodes[id] = [];
  }
  meta.spentPoints = 0;
  meta.earnedPoints = Math.max(0, meta.earnedPoints - lostPoints);
  meta.respecsUsedThisCycle += 1;
  saveMeta(meta);
  return { lostPoints, wasFree };
}

// Called at the start of each new run. Resets the per-cycle respec counter.
export function startNewCycle(meta: MetaProgress) {
  meta.respecsUsedThisCycle = 0;
  saveMeta(meta);
}

// Dev helper: wipe everything (export so we can call from console for debugging).
export function wipeMeta(): MetaProgress {
  const fresh = emptyMeta();
  saveMeta(fresh);
  return fresh;
}
