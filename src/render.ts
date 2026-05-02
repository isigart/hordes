import type { World } from "./types";
import { GAME_CONSTANTS } from "./game";

export function render(ctx: CanvasRenderingContext2D, world: World) {
  const { w, h } = world.arena;

  // background
  ctx.fillStyle = "#0a0a0c";
  ctx.fillRect(0, 0, w, h);

  // subtle grid
  ctx.strokeStyle = "#14141a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < w; x += 40) {
    ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h);
  }
  for (let y = 0; y < h; y += 40) {
    ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5);
  }
  ctx.stroke();

  // arena border
  ctx.strokeStyle = "#2a2a36";
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

  // xp orbs
  for (const o of world.orbs) {
    ctx.fillStyle = "#4f8fd9";
    ctx.fillRect(o.pos.x - 1, o.pos.y - 1, 2, 2);
  }

  // enemies (1-3px)
  for (const e of world.enemies) {
    ctx.fillStyle = e.color;
    const s = Math.max(1, Math.round(e.radius * 2));
    ctx.fillRect(Math.round(e.pos.x - s / 2), Math.round(e.pos.y - s / 2), s, s);
  }

  // projectiles
  for (const p of world.projectiles) {
    ctx.fillStyle = p.color;
    const s = Math.max(1, Math.round(p.radius * 2));
    ctx.fillRect(Math.round(p.pos.x - s / 2), Math.round(p.pos.y - s / 2), s, s);
  }

  // hero
  if (world.hero) {
    const hr = GAME_CONSTANTS.HERO_RADIUS;
    ctx.fillStyle = world.hero.cls.color;
    ctx.fillRect(world.hero.pos.x - hr, world.hero.pos.y - hr, hr * 2, hr * 2);

    // facing tick
    const fx = world.hero.pos.x + Math.cos(world.hero.facing) * (hr + 4);
    const fy = world.hero.pos.y + Math.sin(world.hero.facing) * (hr + 4);
    ctx.fillRect(Math.round(fx) - 1, Math.round(fy) - 1, 2, 2);

    // attack range hint when melee_aoe
    if (world.hero.cls.attackKind === "melee_aoe") {
      ctx.strokeStyle = "rgba(245, 197, 66, 0.10)";
      ctx.beginPath();
      ctx.arc(world.hero.pos.x, world.hero.pos.y, world.hero.cls.aoeRadius ?? 50, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // damage numbers
  ctx.font = "10px ui-monospace, Menlo, monospace";
  ctx.textAlign = "center";
  for (const n of world.dmgNumbers) {
    const a = 1 - n.age / n.ttl;
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = n.color;
    ctx.fillText(n.text, n.pos.x, n.pos.y);
  }
  ctx.globalAlpha = 1;

  // wave timer / progress
  const elapsed = world.now - world.waveStartedAt;
  const ratio = world.phase === "playing" ? Math.min(1, elapsed / world.waveDurationMs) : 0;
  ctx.fillStyle = "#14141a";
  ctx.fillRect(8, 8, 200, 4);
  ctx.fillStyle = "#4f8fd9";
  ctx.fillRect(8, 8, 200 * ratio, 4);

  // top-left text
  ctx.fillStyle = "#d8d8e2";
  ctx.font = "12px ui-monospace, Menlo, monospace";
  ctx.textAlign = "left";
  if (world.hero) {
    const remaining = Math.max(0, world.enemies.length + world.enemiesToSpawn);
    ctx.fillText(
      `Vague ${world.wave}    Ennemis: ${remaining}    Or: ${world.hero.gold}`,
      8, 28,
    );
  }
}
