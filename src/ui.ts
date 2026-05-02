import type { Hero, HeroClassId, StatKey, World } from "./types";
import { STAT_KEYS } from "./types";
import { HERO_CLASSES, spawnHero } from "./heroes";
import { allocate, derived } from "./stats";
import { nextWave } from "./game";

const STAT_LABELS: Record<StatKey, string> = {
  STR: "STR — +5% dégâts phys / pt",
  AGI: "AGI — +4% vitesse atk / pt",
  INT: "INT — +5% dégâts magiques / pt",
  VIT: "VIT — +8 PV max / pt",
  DEX: "DEX — +1% chance crit / pt",
  WIS: "WIS — +3% réduction CD / pt",
  END: "END — +2% réduction dégâts / pt",
  LCK: "LCK — +5% dégâts crit / pt",
};

export function renderHud(world: World, hud: HTMLElement) {
  hud.innerHTML = "";

  if (world.phase === "menu") {
    renderMenu(world, hud);
    return;
  }

  if (!world.hero) return;

  hud.append(buildHeroPanel(world.hero));
  hud.append(buildStatsPanel(world.hero));
  if (world.phase === "wave_clear") {
    hud.append(buildWaveClearPanel(world));
  }
  if (world.phase === "dead") {
    hud.append(buildDeadPanel(world));
  }
}

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function renderMenu(world: World, hud: HTMLElement) {
  const sec = el("div", "hud-section");
  sec.append(el("div", "hud-title", "Choisis ton héros"));
  for (const id of Object.keys(HERO_CLASSES) as HeroClassId[]) {
    const cls = HERO_CLASSES[id];
    const card = el("div", "hero-card");
    card.append(el("h3", undefined, cls.name));
    card.append(el("p", undefined, cls.blurb));
    const stats = el("p");
    stats.style.marginTop = "6px";
    stats.textContent = STAT_KEYS
      .map((k) => `${k} ${cls.baseStats[k]}`)
      .join(" · ");
    card.append(stats);
    card.addEventListener("click", () => {
      world.hero = spawnHero(cls, world.arena.w / 2, world.arena.h / 2);
      world.wave = 0;
      nextWave(world);
    });
    sec.append(card);
  }
  hud.append(sec);

  const help = el("div", "hud-section");
  help.append(el("div", "hud-title", "Comment jouer"));
  const p = el("p");
  p.style.color = "var(--muted)";
  p.innerHTML =
    "Auto-battler. Le héros attaque tout seul. Toi tu construis le build : " +
    "tu gagnes 3 points par niveau, à allouer sur 8 stats. " +
    "Entre les vagues : pause + alloc. Survis aussi longtemps que possible.";
  help.append(p);
  hud.append(help);
}

function buildHeroPanel(hero: Hero): HTMLElement {
  const sec = el("div", "hud-section");
  const title = el("div", "row");
  const left = el("div");
  left.append(el("div", "hud-title", `${hero.cls.name} · niv ${hero.level}`));
  title.append(left);
  const points = el("span", hero.unspentPoints > 0 ? "tag accent" : "tag",
    `${hero.unspentPoints} pts`);
  title.append(points);
  sec.append(title);

  const d = derived(hero);
  const hpBar = el("div", "bar hp");
  const hpFill = el("div", "fill");
  hpFill.style.width = `${(hero.hp / d.maxHp) * 100}%`;
  hpBar.append(hpFill);
  sec.append(hpBar);
  sec.append(el("div", "row", `PV ${Math.round(hero.hp)}/${Math.round(d.maxHp)}`));

  const xpBar = el("div", "bar xp");
  const xpFill = el("div", "fill");
  xpFill.style.width = `${(hero.xp / hero.xpToNext) * 100}%`;
  xpBar.append(xpFill);
  sec.append(xpBar);
  sec.append(el("div", "row", `XP ${hero.xp}/${hero.xpToNext}`));

  return sec;
}

function buildStatsPanel(hero: Hero): HTMLElement {
  const sec = el("div", "hud-section");
  sec.append(el("div", "hud-title", "Stats"));
  const d = derived(hero);

  for (const key of STAT_KEYS) {
    const row = el("div", "stat-row");
    row.append(el("span", "name", key));
    row.append(el("span", undefined, STAT_LABELS[key]));
    row.append(el("span", "val", String(hero.stats[key])));
    const btn = el("button", "stat-btn", "+") as HTMLButtonElement;
    btn.disabled = hero.unspentPoints <= 0;
    btn.addEventListener("click", () => {
      if (allocate(hero, key)) {
        // re-render handled by main loop
      }
    });
    row.append(btn);
    sec.append(row);
  }

  // Derived summary
  const der = el("div");
  der.style.marginTop = "10px";
  der.style.color = "var(--muted)";
  der.style.fontSize = "11px";
  der.innerHTML = [
    `Dmg phys ×${d.physMult.toFixed(2)}`,
    `Dmg magic ×${d.magicMult.toFixed(2)}`,
    `ASPD ×${d.aspd.toFixed(2)}`,
    `Crit ${(d.critChance * 100).toFixed(1)}% ×${d.critDamage.toFixed(2)}`,
    `CDR ${((1 - d.cdr) * 100).toFixed(1)}%`,
    `Réd. dmg ${(d.dmgReduction * 100).toFixed(1)}%`,
    `Régen ${d.hpRegen.toFixed(1)}/s`,
    `Or ×${d.goldMult.toFixed(2)}`,
  ].join("<br>");
  sec.append(der);
  return sec;
}

function buildWaveClearPanel(world: World): HTMLElement {
  const sec = el("div", "hud-section");
  sec.append(el("div", "hud-title", `Vague ${world.wave} terminée`));
  const p = el("p");
  p.style.color = "var(--muted)";
  p.textContent =
    "Alloue tes points puis lance la prochaine vague.";
  sec.append(p);
  const btn = el("button", "btn", "▶ Vague suivante") as HTMLButtonElement;
  btn.addEventListener("click", () => nextWave(world));
  sec.append(btn);
  return sec;
}

function buildDeadPanel(world: World): HTMLElement {
  const sec = el("div", "hud-section");
  sec.append(el("div", "hud-title", "Game Over"));
  const p = el("p");
  p.style.color = "var(--muted)";
  p.textContent = `Tu as tenu ${world.wave} vagues. Recharge la page pour rejouer.`;
  sec.append(p);
  return sec;
}
