// Talent tree overlay — accessed from menu or game-over screens.
// 5 hero panels, each with their 12 nodes laid out on 3 axes (A | S | B).

import type { HeroClassId, World } from "./types";
import { TREES, applyNodeToHero, arePrereqsMet, type TalentNode } from "./talents";
import { availablePoints, isUnlocked, respecAll, unlockNode } from "./meta";
import { HERO_CLASSES, TEAM_ORDER } from "./heroes";

let onClose: (() => void) | null = null;

export function openTalentTree(world: World, close: () => void) {
  onClose = close;
  const overlay = ensureOverlay();
  overlay.innerHTML = "";
  overlay.style.display = "flex";
  document.body.classList.add("tt-open");
  render(overlay, world);
}

export function closeTalentTree() {
  const overlay = document.getElementById("talent-overlay");
  if (overlay) overlay.style.display = "none";
  document.body.classList.remove("tt-open");
  if (onClose) onClose();
}

export function isTalentTreeOpen(): boolean {
  const overlay = document.getElementById("talent-overlay");
  return overlay !== null && overlay.style.display !== "none";
}

function ensureOverlay(): HTMLElement {
  let el = document.getElementById("talent-overlay");
  if (!el) {
    el = document.createElement("div");
    el.id = "talent-overlay";
    document.body.append(el);
  }
  return el;
}

function render(root: HTMLElement, world: World) {
  const meta = world.meta;
  const wrap = document.createElement("div");
  wrap.className = "tt-wrap";

  // Header
  const head = document.createElement("div");
  head.className = "tt-head";

  const title = document.createElement("h1");
  title.textContent = "Arbre des Talents";
  head.append(title);

  const stats = document.createElement("div");
  stats.className = "tt-stats";
  stats.innerHTML =
    `<span><b>${availablePoints(meta)}</b> points dispo</span>` +
    `<span>${meta.spentPoints} investis · ${meta.earnedPoints} totaux</span>` +
    `<span>Vague max atteinte : ${meta.highestWaveReached}</span>`;
  head.append(stats);

  const actions = document.createElement("div");
  actions.className = "tt-actions";

  const respecBtn = document.createElement("button");
  respecBtn.className = "btn";
  const inRun = world.phase === "playing" || world.phase === "draft";
  const respecLabel = inRun
    ? "Respec (entre les runs uniquement)"
    : meta.respecsUsedThisCycle === 0
      ? "Respec gratuit"
      : `Respec (−10% des points investis = ${Math.ceil(meta.spentPoints * 0.1)})`;
  respecBtn.textContent = respecLabel;
  respecBtn.disabled = meta.spentPoints === 0 || inRun;
  respecBtn.title = inRun
    ? "Le respec n'est dispo qu'entre les runs (menu / game over)."
    : "";
  respecBtn.addEventListener("click", () => {
    if (inRun) return;
    if (!confirm("Réinitialiser tous les talents ?")) return;
    respecAll(meta);
    render(root, world);
  });
  actions.append(respecBtn);

  const closeBtn = document.createElement("button");
  closeBtn.className = "btn";
  closeBtn.textContent = "Fermer (Esc)";
  closeBtn.addEventListener("click", () => closeTalentTree());
  actions.append(closeBtn);

  head.append(actions);
  wrap.append(head);

  // Hero columns
  const grid = document.createElement("div");
  grid.className = "tt-grid";
  for (const id of TEAM_ORDER) {
    grid.append(buildHeroColumn(id, world, () => render(root, world)));
  }
  wrap.append(grid);

  root.innerHTML = "";
  root.append(wrap);
}

function buildHeroColumn(
  heroId: HeroClassId,
  world: World,
  onChange: () => void,
): HTMLElement {
  const col = document.createElement("section");
  col.className = "tt-col";
  col.dataset.heroId = heroId;

  const cls = HERO_CLASSES[heroId];
  const head = document.createElement("h2");
  head.style.color = cls.color;
  head.textContent = cls.name;
  col.append(head);

  // Axis labels
  const axesRow = document.createElement("div");
  axesRow.className = "tt-axes";
  const axisLabels = axisLabelsFor(heroId);
  axesRow.innerHTML =
    `<span>${axisLabels.A}</span><span>${axisLabels.S}</span><span>${axisLabels.B}</span>`;
  col.append(axesRow);

  // 4 rows × 3 axes grid (A | S | B)
  const tree = TREES[heroId];
  const byAxisRow: Record<string, TalentNode | undefined> = {};
  for (const n of tree) byAxisRow[`${n.axis}${n.row}`] = n;

  const maxRow = Math.max(...tree.map(n => n.row));
  const grid = document.createElement("div");
  grid.className = "tt-tree";
  for (let r = 1; r <= maxRow; r++) {
    for (const axis of ["A", "S", "B"] as const) {
      const node = byAxisRow[`${axis}${r}`];
      if (!node) {
        const empty = document.createElement("div");
        empty.className = "tt-cell tt-empty";
        grid.append(empty);
      } else {
        grid.append(buildNodeCell(node, world, onChange));
      }
    }
  }
  col.append(grid);
  return col;
}

function axisLabelsFor(heroId: HeroClassId): { A: string; S: string; B: string } {
  switch (heroId) {
    case "knight":   return { A: "Tank", S: "Synergie", B: "DPS-CAC" };
    case "healer":   return { A: "Buffer", S: "Synergie", B: "Debuffer" };
    case "summoner": return { A: "Horde", S: "Synergie", B: "Champion" };
    case "archer":   return { A: "Multishot", S: "Synergie", B: "Sniper" };
    case "mage":     return { A: "Zone", S: "Synergie", B: "Mono" };
  }
}

function buildNodeCell(
  node: TalentNode,
  world: World,
  onChange: () => void,
): HTMLElement {
  const cell = document.createElement("button");
  cell.className = "tt-cell tt-node";
  cell.dataset.axis = node.axis;
  if (node.capstone) cell.classList.add("tt-capstone");

  const meta = world.meta;
  const unlocked = isUnlocked(meta, node.heroId, node.id);
  const meets = arePrereqsMet(node.heroId, node.id, meta.unlockedNodes[node.heroId] ?? []);
  const canBuy = !unlocked && meets && availablePoints(meta) > 0;

  if (unlocked) cell.classList.add("tt-unlocked");
  else if (!meets) cell.classList.add("tt-locked");
  else if (canBuy) cell.classList.add("tt-buyable");
  else cell.classList.add("tt-nopoints");

  cell.innerHTML = `<span class="tt-node-row">R${node.row}</span><span class="tt-node-text">${node.blurb}</span>`;
  cell.title = node.blurb + (node.capstone ? "\n(capstone)" : "");

  cell.addEventListener("click", () => {
    if (unlocked) return;
    if (!meets) return;
    if (availablePoints(meta) <= 0) return;
    if (unlockNode(meta, node.heroId, node.id)) {
      // Live-apply if the hero is currently in the run (draft/playing).
      const liveHero = world.heroes.find((h) => h.cls.id === node.heroId);
      if (liveHero) applyNodeToHero(liveHero, node);
      onChange();
    }
  });
  return cell;
}
