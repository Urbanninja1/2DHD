---
title: "Particle Scale & Room Lighting Overhaul"
date: 2026-02-08
category: ui-bugs
tags:
  - particles
  - lighting
  - rendering
  - three.js
  - shaders
module: rendering
symptoms:
  - Dust motes render as massive white circles (snowstorm effect)
  - Torch embers fill screen with oversized bokeh blobs
  - All 10 rooms appear pitch black — walls, ceiling, props invisible
  - Upper half of viewport is black void
severity: critical
resolved: true
related:
  - docs/solutions/architecture/non-ecs-particle-integration-pattern.md
  - docs/solutions/architecture/hd2d-deferred-effects-pipeline.md
---

# Particle Scale & Room Lighting Overhaul

Two critical visual bugs that made the game unplayable — particles dominated the scene, and rooms were too dark to see any geometry.

## Problem 1: Oversized Particles

### Symptoms

Dust motes and torch embers rendered as massive white/orange circles covering most of the viewport. The throne room looked like a blizzard instead of subtle atmospheric dust.

### Root Cause

The `gl_PointSize` scale factor in both particle shaders was set to `300.0`, which combined with particle sizes of 2-4 (dust) and 1.5-3.5 (embers) produced enormous on-screen circles. Dust alpha of 0.2-0.6 with additive blending made them extremely prominent.

### Fix

**`src/rendering/particles/dust-motes.ts`** — vertex shader + config:

```glsl
// Before
gl_PointSize = aSize * (300.0 / -mvPosition.z);

// After
gl_PointSize = aSize * (80.0 / -mvPosition.z);
```

```typescript
// Before
sizes[i] = 2.0 + Math.random() * 2.0;   // 2-4
alphas[i] = 0.2 + Math.random() * 0.4;   // 0.2-0.6

// After
sizes[i] = 0.4 + Math.random() * 0.6;    // 0.4-1.0
alphas[i] = 0.08 + Math.random() * 0.15;  // 0.08-0.23
```

**`src/rendering/particles/torch-embers.ts`** — same shader fix + sizes:

```typescript
// Before
sizes[i] = 1.5 + Math.random() * 2.0;  // 1.5-3.5

// After
sizes[i] = 0.3 + Math.random() * 0.5;  // 0.3-0.8
```

### Key Insight

With a perspective camera at `(0, 18, 22)` and 35deg FoV, particles at typical scene distances (z ~ -15 to -25 in view space) need a much smaller scale factor. The `300.0 / -mvPosition.z` formula produces pixel sizes of 20-60px at those distances — far too large for atmospheric dust. The corrected `80.0` produces 1-5px particles that read as subtle specks.

---

## Problem 2: Rooms Too Dark

### Symptoms

All 10 rooms were extremely dark. Walls and ceiling were invisible — the upper half of the viewport was pure black. Props (columns, throne, banners) were hidden. Only torch glow spots and NPC sprites were visible.

### Root Cause

Ambient light intensities across all rooms ranged from 0.08 to 0.25, far too low for `MeshStandardMaterial` which has physically-based light response. Point lights had short distances (6-15 units) causing rapid falloff, and intensities (0.8-2.5) too low to illuminate walls at their mounting distance.

### Fix

Boosted all three light types across all 10 room data files while preserving the intended mood hierarchy:

| Room Type | Ambient Before | Ambient After | Point Intensity Before | Point Intensity After |
|-----------|---------------|---------------|----------------------|---------------------|
| Grand (throne, gallery, ballroom) | 0.2-0.35 | 0.55-0.6 | 1.2-3.0 | 2.5-5.0 |
| Intimate (antechamber, council, solar) | 0.15-0.2 | 0.45-0.5 | 0.8-2.5 | 1.8-4.0 |
| Dark (guard post, maegor, stairwell) | 0.08-0.1 | 0.3-0.35 | 1.0-1.8 | 2.0-3.5 |
| Open (battlements) | 0.5 | 0.7 | N/A | N/A |

Point light distances were also increased (6-15 → 10-25) and decay values reduced where needed.

### Key Insight

`MeshStandardMaterial` uses physically-based rendering where ambient light of 0.1-0.2 produces almost nothing visible on dark stone textures (color values 0x2A-0x4A). A minimum ambient of ~0.3 is needed to reveal room geometry, with 0.5+ for well-lit spaces. Point lights need distance values roughly 1.5x the room's largest dimension to reach walls.

---

## Prevention

- When adding new rooms, use these baseline ranges as starting points rather than guessing
- Test new rooms visually immediately after adding them — dark rooms are hard to catch in code review
- The quality scaler (levels 1-6) can reduce lighting at runtime, so start brighter and let the scaler handle low-end devices
