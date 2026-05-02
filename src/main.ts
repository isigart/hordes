import "./style.css";
import { createWorld, step } from "./game";
import { render } from "./render";
import { renderHud } from "./ui";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const hud = document.getElementById("hud") as HTMLElement;

// Render at logical 480x320, scaled up via CSS for crisp pixels.
const ARENA_W = 480;
const ARENA_H = 320;
canvas.width = ARENA_W;
canvas.height = ARENA_H;
ctx.imageSmoothingEnabled = false;

const seed = Date.now() & 0xffffffff;
const world = createWorld(ARENA_W, ARENA_H, seed);

let lastFrame = performance.now();
let lastHudUpdate = 0;

function frame(t: number) {
  const dt = Math.min(50, t - lastFrame); // cap at 50ms to avoid spiral
  lastFrame = t;

  step(world, dt);
  render(ctx, world);

  // HUD updates 4x/sec or on phase change
  if (t - lastHudUpdate > 250 || world.phase === "menu" ||
      world.phase === "wave_clear" || world.phase === "dead") {
    renderHud(world, hud);
    lastHudUpdate = t;
  }

  requestAnimationFrame(frame);
}

renderHud(world, hud);
requestAnimationFrame(frame);
