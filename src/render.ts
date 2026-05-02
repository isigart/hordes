import type { Hero, World } from "./types";
import { aggregateProfile } from "./gems";
import { getBiome } from "./biomes";

// Each hero is a 3×4 figurative sprite — head, shoulders, body, legs split.
// Class signifier (helmet / hat / etc.) sits 1 px above the head.
function drawHeroSprite(
  ctx: CanvasRenderingContext2D,
  hero: Hero,
  cx: number,
  cy: number,
) {
  if (hero.hp <= 0) {
    // collapsed body lying down
    ctx.fillStyle = "#3a3a48";
    ctx.fillRect(cx - 1, cy + 1, 3, 1);
    return;
  }
  const c = hero.cls.color;
  ctx.fillStyle = c;
  // head
  ctx.fillRect(cx, cy - 2, 1, 1);
  // shoulders / arms (3 wide)
  ctx.fillRect(cx - 1, cy - 1, 3, 1);
  // torso
  ctx.fillRect(cx, cy, 1, 1);
  // legs splayed
  ctx.fillRect(cx - 1, cy + 1, 1, 1);
  ctx.fillRect(cx + 1, cy + 1, 1, 1);

  // class signifier above/around the head
  switch (hero.cls.id) {
    case "knight":
      // shield to the left
      ctx.fillStyle = c;
      ctx.fillRect(cx - 2, cy, 1, 1);
      break;
    case "archer":
      // bow to the right
      ctx.fillStyle = c;
      ctx.fillRect(cx + 2, cy, 1, 1);
      break;
    case "healer":
      // tiny cross above the head
      ctx.fillStyle = "rgba(255, 245, 200, 0.95)";
      ctx.fillRect(cx, cy - 3, 1, 1);
      ctx.fillRect(cx - 1, cy - 3 + 0, 1, 1); // left of cross — collapses with head row
      // simpler: 1px halo
      break;
    case "mage":
      // pointy hat
      ctx.fillStyle = c;
      ctx.fillRect(cx, cy - 3, 1, 1);
      break;
    case "summoner":
      // skull / orb above
      ctx.fillStyle = "rgba(232, 200, 232, 0.9)";
      ctx.fillRect(cx, cy - 3, 1, 1);
      // little floating orb
      ctx.fillStyle = c;
      ctx.fillRect(cx - 2, cy + 1, 1, 1);
      break;
  }
}

// Minion sprite — small bone-colored 1×2 figure (smaller than a hero).
function drawMinion(
  ctx: CanvasRenderingContext2D,
  pos: { x: number; y: number },
  color: string,
) {
  const cx = Math.round(pos.x);
  const cy = Math.round(pos.y);
  ctx.fillStyle = color;
  ctx.fillRect(cx, cy - 1, 1, 1);
  ctx.fillRect(cx, cy, 1, 1);
}

export function render(ctx: CanvasRenderingContext2D, world: World) {
  const { w, h } = world.arena;
  const biome = getBiome(world.wave);

  // === Step 1 : clear at full canvas size, no transform ===
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#0a0a0c";
  ctx.fillRect(0, 0, w, h);

  // === Step 2 : compute zoom + camera offset, then apply transform ===
  const zoom = Math.max(1, world.zoom || 1);
  let camX = 0, camY = 0;
  if (zoom > 1 && world.heroes.length > 0) {
    let sx = 0, sy = 0;
    for (const hero of world.heroes) { sx += hero.pos.x; sy += hero.pos.y; }
    const cx = sx / world.heroes.length;
    const cy = sy / world.heroes.length;
    const halfW = (w / zoom) / 2;
    const halfH = (h / zoom) / 2;
    camX = Math.max(0, Math.min(w - halfW * 2, cx - halfW));
    camY = Math.max(0, Math.min(h - halfH * 2, cy - halfH));
  }
  ctx.setTransform(zoom, 0, 0, zoom, -camX * zoom, -camY * zoom);

  if (biome.bgTint) {
    ctx.fillStyle = biome.bgTint;
    ctx.fillRect(0, 0, w, h);
  }

  // grid
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

  // mob spawn line at top
  ctx.strokeStyle = "rgba(217, 79, 79, 0.25)";
  ctx.beginPath();
  ctx.moveTo(0, 12.5); ctx.lineTo(w, 12.5);
  ctx.stroke();

  // xp orbs
  for (const o of world.orbs) {
    ctx.fillStyle = "#4f8fd9";
    ctx.fillRect(Math.round(o.pos.x - 1), Math.round(o.pos.y - 1), 2, 2);
  }

  // enemies
  for (const e of world.enemies) {
    const s = Math.max(1, Math.round(e.radius * 2));
    // tint when burning / poisoned
    let color = e.color;
    if (e.poison) color = "#9fd96f";
    else if (e.burn) color = "#ff7a3d";
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(e.pos.x - s / 2), Math.round(e.pos.y - s / 2), s, s);
    if (e.vulnerable) {
      ctx.strokeStyle = "rgba(245, 197, 66, 0.6)";
      ctx.strokeRect(
        Math.round(e.pos.x - s / 2) - 0.5,
        Math.round(e.pos.y - s / 2) - 0.5,
        s + 1, s + 1,
      );
    }
  }

  // projectiles
  for (const p of world.projectiles) {
    ctx.fillStyle = p.color;
    const s = Math.max(1, Math.round(p.radius * 2));
    ctx.fillRect(Math.round(p.pos.x - s / 2), Math.round(p.pos.y - s / 2), s, s);
  }

  // minions (summoned by Summoner)
  for (const m of world.minions) {
    drawMinion(ctx, m.pos, m.color);
  }

  // heroes — small figurative 3×4 sprite placed in a fixed 10×10 zone
  const ZONE = 10;
  for (const hero of world.heroes) {
    const cx = Math.round(hero.pos.x);
    const cy = Math.round(hero.pos.y);

    // 10×10 deployment zone outline
    ctx.strokeStyle = hero.heroIndex === world.activeHeroIndex
      ? "rgba(245, 197, 66, 0.65)"
      : (hero.hp > 0 ? "rgba(216, 216, 226, 0.16)" : "rgba(216, 216, 226, 0.06)");
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - ZONE / 2 + 0.5, cy - ZONE / 2 + 0.5, ZONE - 1, ZONE - 1);

    // faint color tint in the zone (identifies class at a glance)
    if (hero.hp > 0) {
      ctx.fillStyle = hero.cls.color + "16"; // ~9% alpha
      ctx.fillRect(cx - ZONE / 2 + 1, cy - ZONE / 2 + 1, ZONE - 2, ZONE - 2);
    }

    drawHeroSprite(ctx, hero, cx, cy);

    // taunt radius hint
    const profile = aggregateProfile(hero.gems);
    if (profile.taunt && hero.hp > 0) {
      ctx.strokeStyle = "rgba(95, 207, 217, 0.08)";
      ctx.beginPath();
      ctx.arc(hero.pos.x, hero.pos.y, profile.taunt.radius, 0, Math.PI * 2);
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

  // === Step 3 : reset transform for screen-space HUD overlay ===
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // wave timer / progress
  const elapsed = world.now - world.waveStartedAt;
  const ratio = world.phase === "playing" ? Math.min(1, elapsed / world.waveDurationMs) : 0;
  ctx.fillStyle = "#14141a";
  ctx.fillRect(8, 8, 200, 4);
  ctx.fillStyle = "#4f8fd9";
  ctx.fillRect(8, 8, 200 * ratio, 4);

  ctx.fillStyle = "#d8d8e2";
  ctx.font = "12px ui-monospace, Menlo, monospace";
  ctx.textAlign = "left";
  if (world.heroes.length > 0) {
    const remaining = Math.max(0, world.enemies.length + world.enemiesToSpawn);
    ctx.fillText(
      `Vague ${world.wave}    Mobs: ${remaining}    Or: ${world.gold}`,
      8, 28,
    );
  }

  // zoom/speed indicators top-right
  ctx.textAlign = "right";
  const indicators: string[] = [];
  if (world.timeScale > 1) indicators.push(`×${world.timeScale}`);
  if (world.zoom > 1) indicators.push(`zoom ${world.zoom.toFixed(1)}`);
  if (indicators.length > 0) {
    ctx.fillStyle = "#f5c542";
    ctx.fillText(indicators.join("  "), w - 8, 16);
  }
}
