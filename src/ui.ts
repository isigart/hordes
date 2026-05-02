import type { Gem, Hero, StatKey, World } from "./types";
import { STAT_KEYS } from "./types";
import { allocate, derived } from "./stats";
import {
  assignGemToHero, budgetBreakdown, nextWave, pickGemForDraft, removeGemFromHero,
  setActiveHero, setTimeScale, setZoom, skipDraft, startRun, usedBudget,
  zoomIn, zoomOut,
} from "./game";
import { CAMPAIGN_WAVES, isEndless } from "./waves";
import { getBiome, isBossWave } from "./biomes";
import { availablePoints } from "./meta";
import { openTalentTree } from "./talent-ui";

let hudDirty = true;
export function markHudDirty() { hudDirty = true; }
export function isHudDirty(): boolean {
  if (hudDirty) { hudDirty = false; return true; }
  return false;
}

const STAT_LABELS: Record<StatKey, string> = {
  STR: "STR — +5% dmg phys / pt",
  AGI: "AGI — +4% atk speed / pt",
  INT: "INT — +5% dmg magic / pt",
  VIT: "VIT — +8 PV max / pt",
  DEX: "DEX — +1% chance crit / pt",
  WIS: "WIS — +3% red. CD / pt",
  END: "END — +2% red. dmg / pt",
  LCK: "LCK — +5% dmg crit / pt",
};

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function renderHud(world: World, hud: HTMLElement) {
  hud.innerHTML = "";

  if (world.phase === "menu") {
    renderMenu(world, hud);
    return;
  }

  hud.append(buildRunInfoPanel(world));
  hud.append(buildBudgetPanel(world));
  hud.append(buildTeamPanel(world));

  if (world.phase === "draft") {
    hud.append(buildDraftPanel(world));
  }

  const active = world.heroes[world.activeHeroIndex];
  if (active) {
    hud.append(buildActiveHeroPanel(active, world));
  }

  if (world.phase === "dead") {
    hud.append(buildDeadPanel(world));
  }
}

// ---------- menu ----------
function renderMenu(world: World, hud: HTMLElement) {
  const sec = el("div", "hud-section");
  sec.append(el("h2", undefined, "Hordes"));
  const p = el("p");
  p.style.color = "var(--muted)";
  p.innerHTML =
    "Auto-battler en formation. 5 héros tiennent une ligne en bas de l'arène, " +
    "les hordes descendent du nord. Tu construis le build : 8 stats par héros + " +
    "gemmes à un budget partagé.<br><br>" +
    `Campagne <b>100 vagues</b>, puis <b>endless</b>. Difficulté progressive ` +
    `(~20 mobs vague 1, ~2000 vague 100, illimité après).`;
  sec.append(p);

  const startBtn = el("button", "btn", "▶ Lancer le run") as HTMLButtonElement;
  startBtn.style.marginTop = "12px";
  startBtn.addEventListener("click", () => {
    startRun(world);
    markHudDirty();
  });
  sec.append(startBtn);

  // Meta-progression badge
  const meta = world.meta;
  const points = availablePoints(meta);
  const treeBtn = el("button", "btn",
    `Arbre des Talents (${points > 0 ? `${points} dispo · ` : ""}${meta.spentPoints}/${meta.earnedPoints})`,
  ) as HTMLButtonElement;
  treeBtn.style.marginTop = "8px";
  if (points > 0) {
    treeBtn.style.borderColor = "var(--accent)";
    treeBtn.style.color = "var(--accent)";
  }
  treeBtn.addEventListener("click", () => {
    openTalentTree(world, () => markHudDirty());
  });
  sec.append(treeBtn);

  // intro of classes
  const intro = el("div", "hud-section");
  intro.append(el("div", "hud-title", "Composition fixe"));
  const list = el("p");
  list.style.color = "var(--muted)";
  list.innerHTML =
    "<b>Chevalier</b> — apex tank, AOE mêlée.<br>" +
    "<b>Healer</b> — chaque attaque soigne l'allié le plus blessé.<br>" +
    "<b>Summoner</b> — invoque des squelettes qui combattent.<br>" +
    "<b>Archer</b> — distance, single-target rapide, crit.<br>" +
    "<b>Mage</b> — distance AOE, wave clear.";
  intro.append(list);
  hud.append(sec);
  hud.append(intro);
}

// ---------- run info ----------
function buildRunInfoPanel(world: World): HTMLElement {
  const sec = el("div", "hud-section");
  const head = el("div", "row");
  const endless = isEndless(world.wave);
  const biome = getBiome(world.wave);
  const waveLabel = endless
    ? `Endless · V${world.wave - CAMPAIGN_WAVES}`
    : `Vague ${world.wave}/${CAMPAIGN_WAVES}`;
  const titleEl = el("div", "hud-title", waveLabel);
  if (endless) (titleEl as HTMLElement).style.color = "var(--bad)";
  head.append(titleEl);
  head.append(el("span", "tag accent", `${world.gold}g`));
  sec.append(head);

  // biome banner
  const biomeRow = el("div", "row");
  const biomeName = el("span", undefined,
    `${biome.name}${isBossWave(world.wave) ? " · BOSS" : ""}`);
  (biomeName as HTMLElement).style.color = biome.palette.boss;
  (biomeName as HTMLElement).style.fontWeight = "600";
  biomeRow.append(biomeName);
  const formLabel: Record<string, string> = {
    top_random: "Random top",
    top_cluster: "Clusters",
    top_wave: "Vagues sync",
    multi_dir: "Multi-côtés",
  };
  biomeRow.append(el("span", "tag", formLabel[biome.formation]));
  sec.append(biomeRow);

  const biomeBlurb = el("p");
  biomeBlurb.style.fontSize = "11px";
  biomeBlurb.style.color = "var(--muted)";
  biomeBlurb.style.margin = "2px 0 6px 0";
  biomeBlurb.textContent = biome.description;
  sec.append(biomeBlurb);

  // campaign progress bar (only during campaign)
  if (!endless) {
    const campaignBar = el("div", "bar");
    const fill = el("div", "fill");
    fill.style.width = `${(world.wave / CAMPAIGN_WAVES) * 100}%`;
    fill.style.background = "var(--accent)";
    campaignBar.append(fill);
    sec.append(campaignBar);
  }

  const xpBar = el("div", "bar xp");
  const xpFill = el("div", "fill");
  xpFill.style.width = `${(world.xp / world.xpToNext) * 100}%`;
  xpBar.append(xpFill);
  sec.append(xpBar);
  sec.append(el("div", "row",
    `Niv ${world.level} · XP ${Math.floor(world.xp)}/${world.xpToNext}`));

  // speed + zoom controls
  const ctrl = el("div");
  ctrl.style.display = "grid";
  ctrl.style.gridTemplateColumns = "1fr 1fr";
  ctrl.style.gap = "6px";
  ctrl.style.marginTop = "10px";

  const speedGroup = el("div");
  speedGroup.style.display = "flex";
  speedGroup.style.gap = "2px";
  for (const s of [1, 2, 4]) {
    const b = el("button", "btn", `×${s}`) as HTMLButtonElement;
    b.style.padding = "4px 0";
    b.style.flex = "1";
    if (world.timeScale === s) {
      b.style.borderColor = "var(--accent)";
      b.style.color = "var(--accent)";
    }
    b.addEventListener("click", () => {
      setTimeScale(world, s);
      markHudDirty();
    });
    speedGroup.append(b);
  }
  ctrl.append(speedGroup);

  const zoomGroup = el("div");
  zoomGroup.style.display = "flex";
  zoomGroup.style.gap = "2px";
  zoomGroup.style.alignItems = "center";
  const zo = el("button", "btn", "−") as HTMLButtonElement;
  zo.style.padding = "4px 0";
  zo.style.flex = "1";
  zo.addEventListener("click", () => { zoomOut(world); markHudDirty(); });
  const zLabel = el("span", "tag", `${world.zoom.toFixed(1)}×`);
  (zLabel as HTMLElement).style.minWidth = "36px";
  (zLabel as HTMLElement).style.textAlign = "center";
  const zr = el("button", "btn", "○") as HTMLButtonElement;
  zr.title = "Reset zoom";
  zr.style.padding = "4px 0";
  zr.style.flex = "0 0 24px";
  zr.addEventListener("click", () => { setZoom(world, 1); markHudDirty(); });
  const zi = el("button", "btn", "+") as HTMLButtonElement;
  zi.style.padding = "4px 0";
  zi.style.flex = "1";
  zi.addEventListener("click", () => { zoomIn(world); markHudDirty(); });
  zoomGroup.append(zo); zoomGroup.append(zLabel); zoomGroup.append(zr); zoomGroup.append(zi);
  ctrl.append(zoomGroup);

  sec.append(ctrl);

  const hint = el("p");
  hint.style.fontSize = "10px";
  hint.style.color = "var(--muted)";
  hint.style.margin = "6px 0 0 0";
  hint.textContent = "Raccourcis : 1/2/4 vitesse · +/− ou molette zoom · 0 reset";
  sec.append(hint);

  return sec;
}

// ---------- budget ----------
function buildBudgetPanel(world: World): HTMLElement {
  const sec = el("div", "hud-section");
  const used = usedBudget(world);
  const total = world.socketBudget;
  const breakdown = budgetBreakdown(world);
  const head = el("div", "row");
  head.append(el("div", "hud-title", "Budget gemmes"));
  head.append(el("span", used >= total ? "tag" : "tag accent", `${used}/${total}`));
  sec.append(head);

  const bar = el("div", "bar");
  const fill = el("div", "fill");
  fill.style.width = `${Math.min(100, (used / total) * 100)}%`;
  fill.style.background = "var(--accent)";
  bar.append(fill);
  sec.append(bar);

  const detail = el("p");
  detail.style.fontSize = "10px";
  detail.style.color = "var(--muted)";
  detail.style.margin = "4px 0 0 0";
  detail.innerHTML =
    `Base ${breakdown.base}` +
    ` · Niveau +${breakdown.fromLevel}` +
    ` · Boss ×${world.bossesDefeated} (+${breakdown.fromBosses})`;
  sec.append(detail);

  return sec;
}

// ---------- team ----------
function buildTeamPanel(world: World): HTMLElement {
  const sec = el("div", "hud-section");
  sec.append(el("div", "hud-title", "Équipe"));

  for (const hero of world.heroes) {
    const card = el("div", "hero-card");
    card.style.padding = "6px 8px";
    card.style.cursor = "pointer";
    card.style.borderColor =
      world.activeHeroIndex === hero.heroIndex ? "var(--accent)" : "var(--border)";
    card.style.opacity = hero.hp > 0 ? "1" : "0.45";

    const head = el("div", "row");
    const name = el("span", undefined, `${hero.cls.name}`);
    (name as HTMLElement).style.color = hero.cls.color;
    head.append(name);
    head.append(el("span", "tag", `${hero.gems.length}g`));
    card.append(head);

    const hpBar = el("div", "bar hp");
    hpBar.style.marginTop = "4px";
    const hpFill = el("div", "fill");
    hpFill.style.width = `${Math.max(0, (hero.hp / hero.maxHp) * 100)}%`;
    hpBar.append(hpFill);
    card.append(hpBar);

    if (hero.hp <= 0) {
      const dead = el("p");
      dead.style.color = "var(--bad)";
      dead.style.fontSize = "11px";
      dead.style.margin = "2px 0 0 0";
      dead.textContent = "K.O.";
      card.append(dead);
    } else if (hero.unspentPoints > 0) {
      const pts = el("p");
      pts.style.color = "var(--accent)";
      pts.style.fontSize = "11px";
      pts.style.margin = "2px 0 0 0";
      pts.textContent = `${hero.unspentPoints} pts à allouer`;
      card.append(pts);
    }

    card.addEventListener("click", () => {
      setActiveHero(world, hero.heroIndex);
      markHudDirty();
    });
    sec.append(card);
  }
  return sec;
}

// ---------- active hero detail ----------
function buildActiveHeroPanel(hero: Hero, world: World): HTMLElement {
  const sec = el("div", "hud-section");
  const head = el("div", "row");
  const title = el("div", "hud-title", `${hero.cls.name} · niv ${hero.level}`);
  head.append(title);
  head.append(el("span", hero.unspentPoints > 0 ? "tag accent" : "tag",
    `${hero.unspentPoints} pts`));
  sec.append(head);

  const d = derived(hero);

  // HP / shield bar
  const hpBar = el("div", "bar hp");
  const hpFill = el("div", "fill");
  hpFill.style.width = `${Math.max(0, (hero.hp / d.maxHp) * 100)}%`;
  hpBar.append(hpFill);
  sec.append(hpBar);
  const hpRow = `PV ${Math.round(hero.hp)}/${Math.round(d.maxHp)}`
    + (hero.shieldHp > 0 ? ` · ◇ ${Math.round(hero.shieldHp)}` : "")
    + (hero.bloodlustStacks > 0 ? ` · ❤︎ ${hero.bloodlustStacks}` : "");
  sec.append(el("div", "row", hpRow));

  // Stats grid
  for (const key of STAT_KEYS) {
    const row = el("div", "stat-row");
    row.append(el("span", "name", key));
    row.append(el("span", undefined, STAT_LABELS[key]));
    row.append(el("span", "val", String(hero.stats[key])));
    const btn = el("button", "stat-btn", "+") as HTMLButtonElement;
    btn.disabled = hero.unspentPoints <= 0;
    btn.addEventListener("click", () => {
      if (allocate(hero, key)) markHudDirty();
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
    `Réd. dmg ${(d.dmgReduction * 100).toFixed(1)}%`,
    `Régen ${d.hpRegen.toFixed(1)}/s`,
    `Or ×${d.goldMult.toFixed(2)}`,
  ].join(" · ");
  sec.append(der);

  // Equipped gems
  const gemsTitle = el("div", "hud-title");
  gemsTitle.style.marginTop = "12px";
  gemsTitle.textContent = `Gemmes (${hero.gems.length})`;
  sec.append(gemsTitle);

  // Filter out the synthetic "_talent" gem (talent-derived effects, not removable)
  const visible = hero.gems.map((g, i) => ({ g, i })).filter(x => x.g.id !== "_talent");
  if (visible.length === 0) {
    const p = el("p");
    p.style.color = "var(--muted)";
    p.textContent = "Aucune.";
    sec.append(p);
  } else {
    for (const { g, i } of visible) {
      const c = el("div", "hero-card");
      c.style.padding = "6px 8px";
      const h = el("div", "row");
      h.append(el("span", undefined, `${g.name}`));
      const cost = el("span", "tag accent", `[${g.cost}]`);
      h.append(cost);
      c.append(h);
      const blurb = el("p");
      blurb.style.fontSize = "11px";
      blurb.style.color = "var(--muted)";
      blurb.style.margin = "2px 0 0 0";
      blurb.textContent = g.blurb;
      c.append(blurb);
      // remove button (only between waves)
      if (world.phase === "draft") {
        const rm = el("button", "btn", "× retirer") as HTMLButtonElement;
        rm.style.marginTop = "4px";
        rm.addEventListener("click", (ev) => {
          ev.stopPropagation();
          removeGemFromHero(world, hero.heroIndex, i);
          markHudDirty();
        });
        c.append(rm);
      }
      sec.append(c);
    }
  }

  return sec;
}

// ---------- draft ----------
function buildDraftPanel(world: World): HTMLElement {
  const sec = el("div", "hud-section");
  sec.append(el("div", "hud-title", `Vague ${world.wave} terminée — Draft`));

  // Talent tree access between waves
  const meta = world.meta;
  const points = availablePoints(meta);
  if (points > 0 || meta.spentPoints > 0) {
    const treeBtn = el("button", "btn",
      points > 0
        ? `🌳 Arbre des Talents — ${points} point${points > 1 ? "s" : ""} à investir`
        : `🌳 Arbre des Talents (${meta.spentPoints} investis)`,
    ) as HTMLButtonElement;
    treeBtn.style.marginBottom = "8px";
    if (points > 0) {
      treeBtn.style.borderColor = "var(--accent)";
      treeBtn.style.color = "var(--accent)";
    }
    treeBtn.addEventListener("click", () => {
      openTalentTree(world, () => markHudDirty());
    });
    sec.append(treeBtn);
  }

  if (world.draftOffer.length > 0) {
    const intro = el("p");
    intro.style.color = "var(--muted)";
    intro.textContent = world.draftPickedIndex < 0
      ? "Choisis une gemme dans la pioche :"
      : "Sélectionne le héros qui va recevoir cette gemme :";
    sec.append(intro);

    if (world.draftPickedIndex < 0) {
      const used = usedBudget(world);
      for (let i = 0; i < world.draftOffer.length; i++) {
        const g = world.draftOffer[i];
        const card = buildGemCard(g);
        const fits = used + g.cost <= world.socketBudget;
        if (!fits) {
          card.style.opacity = "0.4";
          card.style.cursor = "not-allowed";
          const note = el("p");
          note.style.color = "var(--bad)";
          note.style.fontSize = "10px";
          note.style.marginTop = "4px";
          note.textContent = "Budget insuffisant — retire une gemme d'abord";
          card.append(note);
        } else {
          card.style.cursor = "pointer";
          card.addEventListener("click", () => {
            pickGemForDraft(world, i);
            markHudDirty();
          });
        }
        sec.append(card);
      }
    } else {
      // hero target selection
      const g = world.draftOffer[world.draftPickedIndex];
      const card = buildGemCard(g);
      sec.append(card);

      const heroPick = el("div");
      heroPick.style.marginTop = "8px";
      for (const h of world.heroes) {
        const btn = el("button", "btn") as HTMLButtonElement;
        btn.style.marginTop = "4px";
        const tag = h.hp <= 0 ? " · K.O." : "";
        btn.textContent = `→ ${h.cls.name}${tag} (${h.gems.length} gemmes)`;
        btn.addEventListener("click", () => {
          assignGemToHero(world, h.heroIndex);
          setActiveHero(world, h.heroIndex);
          markHudDirty();
        });
        heroPick.append(btn);
      }
      sec.append(heroPick);

      const back = el("button", "btn", "← annuler le choix") as HTMLButtonElement;
      back.style.marginTop = "8px";
      back.addEventListener("click", () => {
        world.draftPickedIndex = -1;
        markHudDirty();
      });
      sec.append(back);
    }

    const skip = el("button", "btn", "Passer le draft") as HTMLButtonElement;
    skip.style.marginTop = "10px";
    skip.addEventListener("click", () => {
      skipDraft(world);
      markHudDirty();
    });
    sec.append(skip);
  } else {
    const p = el("p");
    p.style.color = "var(--muted)";
    p.textContent = "Tu peux retirer des gemmes pour libérer du budget, allouer des stats, puis lancer la suivante.";
    sec.append(p);
  }

  const next = el("button", "btn", "▶ Vague suivante") as HTMLButtonElement;
  next.style.marginTop = "8px";
  next.addEventListener("click", () => {
    skipDraft(world);
    nextWave(world);
    markHudDirty();
  });
  sec.append(next);

  return sec;
}

function buildGemCard(g: Gem): HTMLElement {
  const c = el("div", "hero-card");
  const h = el("div", "row");
  const name = el("h3", undefined, g.name);
  (name as HTMLElement).style.color = colorForCategory(g.category);
  h.append(name);
  h.append(el("span", "tag accent", `[${g.cost}]`));
  c.append(h);
  c.append(el("p", undefined, g.blurb));
  const cat = el("p");
  cat.style.color = "var(--muted)";
  cat.style.fontSize = "10px";
  cat.style.marginTop = "4px";
  cat.textContent = g.category;
  c.append(cat);
  return c;
}

function colorForCategory(cat: Gem["category"]): string {
  switch (cat) {
    case "soin": return "#6fd97f";
    case "defense": return "#5fcfd9";
    case "offensive": return "#d94f4f";
    case "statut": return "#d9954f";
    case "pattern": return "#b06fd9";
    case "utilite": return "#f5c542";
  }
}

function buildDeadPanel(world: World): HTMLElement {
  const sec = el("div", "hud-section");
  sec.append(el("div", "hud-title", "Game Over"));
  const meta = world.meta;
  const points = availablePoints(meta);
  const p = el("p");
  p.style.color = "var(--muted)";
  p.innerHTML =
    `L'équipe est tombée vague <b>${world.wave}</b>.<br>` +
    `Vague max atteinte : <b>${meta.highestWaveReached}</b><br>` +
    `Points talents : ${meta.spentPoints} / ${meta.earnedPoints} ` +
    (points > 0 ? `<span style="color:var(--accent)">(${points} à investir)</span>` : "");
  sec.append(p);

  const treeBtn = el("button", "btn", "Arbre des Talents") as HTMLButtonElement;
  treeBtn.style.marginTop = "8px";
  if (points > 0) {
    treeBtn.style.borderColor = "var(--accent)";
    treeBtn.style.color = "var(--accent)";
  }
  treeBtn.addEventListener("click", () => {
    openTalentTree(world, () => markHudDirty());
  });
  sec.append(treeBtn);

  const restartBtn = el("button", "btn", "▶ Nouvelle run") as HTMLButtonElement;
  restartBtn.style.marginTop = "8px";
  restartBtn.addEventListener("click", () => {
    startRun(world);
    markHudDirty();
  });
  sec.append(restartBtn);

  return sec;
}
