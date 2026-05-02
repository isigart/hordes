import "./style.css";
import type { GamePhase } from "./types";
import { createWorld, setTimeScale, setZoom, step, zoomIn, zoomOut } from "./game";
import { render } from "./render";
import { renderHud, markHudDirty, isHudDirty } from "./ui";
import { closeTalentTree, isTalentTreeOpen, openTalentTree } from "./talent-ui";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const hud = document.getElementById("hud") as HTMLElement;

// Logical resolution: portrait-ish to give vertical depth (mobs descend from top).
const ARENA_W = 720;
const ARENA_H = 540;
canvas.width = ARENA_W;
canvas.height = ARENA_H;
ctx.imageSmoothingEnabled = false;

const seed = Date.now() & 0xffffffff;
const world = createWorld(ARENA_W, ARENA_H, seed);

let lastFrame = performance.now();
let lastHudUpdate = 0;
let lastPhase: GamePhase = world.phase;

function frame(t: number) {
  const realDt = Math.min(50, t - lastFrame);
  lastFrame = t;

  // Apply time scale by stepping the simulation N times for N×.
  // Stepping in sub-slices keeps physics stable at high speeds.
  const scale = world.timeScale;
  if (scale <= 1) {
    step(world, realDt);
  } else {
    const sub = realDt;
    for (let i = 0; i < scale; i++) step(world, sub);
  }
  render(ctx, world);

  // Re-render HUD only when something changed:
  //  - phase changed (menu -> playing, playing -> wave_clear, etc.)
  //  - explicit dirty flag (e.g. stat point allocated)
  //  - periodic refresh while playing, for HP/XP bars (every 250ms)
  const phaseChanged = world.phase !== lastPhase;
  const periodic = world.phase === "playing" && t - lastHudUpdate > 250;
  if (phaseChanged || isHudDirty() || periodic) {
    renderHud(world, hud);
    lastHudUpdate = t;
    lastPhase = world.phase;
  }

  requestAnimationFrame(frame);
}

renderHud(world, hud);
markHudDirty();

// Keyboard shortcuts.
//   1 / 2 / 4 — speed
//   +  / -    — zoom in / out
//   0         — reset zoom
//   T         — open talent tree (menu / dead only)
//   Esc       — close talent tree
window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (e.key === "Escape" && isTalentTreeOpen()) { closeTalentTree(); return; }
  if (isTalentTreeOpen()) return; // ignore other keys while tree open
  switch (e.key) {
    case "1": setTimeScale(world, 1); markHudDirty(); break;
    case "2": setTimeScale(world, 2); markHudDirty(); break;
    case "4": setTimeScale(world, 4); markHudDirty(); break;
    case "+": case "=": zoomIn(world); markHudDirty(); break;
    case "-": case "_": zoomOut(world); markHudDirty(); break;
    case "0": setZoom(world, 1); markHudDirty(); break;
    case "t": case "T":
      // Tree accessible between runs (menu/dead) and between waves (draft)
      if (world.phase === "menu" || world.phase === "dead" || world.phase === "draft") {
        openTalentTree(world, () => markHudDirty());
      }
      break;
  }
});

// Mouse wheel on the canvas → zoom.
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  if (e.deltaY < 0) zoomIn(world);
  else zoomOut(world);
  markHudDirty();
}, { passive: false });

requestAnimationFrame(frame);
