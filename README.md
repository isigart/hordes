# Hordes

Auto-battler minimaliste. 1 héros, hordes d'ennemis 1px, build profond.

## Stack

TypeScript + Vite + Canvas 2D.

## Run

```bash
npm install
npm run dev
```

Ouvre http://localhost:5173.

## Build

```bash
npm run build
npm run preview
```

## Concept

- 1 héros choisi au départ (3 classes : Knight, Archer, Mage).
- 8 stats granulaires : STR, AGI, INT, VIT, DEX, WIS, END, LCK.
- Skills modulaires avec modifiers.
- Vagues d'ennemis, XP, level up entre les vagues.
- Auto-battle : tu construis le build, le héros se bat.

## Status

V0 — squelette jouable.
