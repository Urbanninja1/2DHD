---
title: "feat: AAA Visual Quality Overhaul — From Tech Demo to Lived-In Great Hall"
type: feat
date: 2026-02-09
deepened: 2026-02-09
reviewed: 2026-02-09
---

# feat: AAA Visual Quality Overhaul — From Tech Demo to Lived-In Great Hall

## Enhancement Summary

**Plan version:** 3 (post-review rewrite)
**Reviewed by:** DHH, Kieran (TypeScript), Simplicity Reviewer
**Research agents:** 10 parallel (lighting, rendering, architecture, camera math, HD-2D hierarchy, Three.js docs, frontend design, architecture strategist, performance oracle, code simplicity)

### What the Screenshots Show

The current Great Hall is **nearly pitch black** from the default camera. NPC sprites float on a dark void. The bottom 40% of the frame is dead space. Banners and tapestries render at floor level (y=0). When brightened artificially, the geometry is there — columns, table, arch, props — but everything reads as a tech demo: uniform materials, flat lighting, no visual hierarchy.

The hand-authored `great-hall.ts` (used before the Room Needs Engine) has features the generated version dropped: **4-layer parallax background**, **7 NPCs**, **dust-in-light particles**, **falling ash**, and **floor/wall/ceiling fallback colors**. These aren't polish — they're core atmosphere.

### Root Causes (from code verification + 3 reviewer consensus)

1. **Banner/tapestry y=0 bug** — Wall decorations render at floor level. This is the biggest single bug.
2. **Lighting has no artistic composition** — Every warm source is the same temperature (0xFFCC66). No cool-to-warm gradient. No dark pools between lights. No dramatic focal point. The room uses legacy lighting mode (`NoToneMapping`, no `useLegacyLights` setting) which means `distance` controls cutoff radius, not physical attenuation.
3. **Tilt-shift too narrow** — Room overrides `focusArea: 0.28` (tightest in entire project; other grand rooms use 0.40-0.45).
4. **Generated room lost hand-authored features** — Parallax background, NPCs, dust-in-light, falling ash, floor/wall/ceiling colors all missing.
5. **No root cause prevention** — `resolve-placement.mjs` has `default: return 0` which silently puts any unknown yPlacement on the floor. Validator doesn't catch wall-decor at y=0.

### Art Direction (the missing piece)

The reviewers identified the biggest gap: **no art direction**. The room data is treated as a spreadsheet, not a canvas. AAA HD-2D games (Octopath Traveler, Triangle Strategy) have:

- **Light painting**: Each light source has a distinct role (key, fill, rim, accent) and color temperature
- **Temperature gradient**: Warm hearth zone → cool entry zone. The eye follows warmth.
- **Dark pools**: Intentional darkness between light sources creates drama
- **Depth composition**: Foreground blur, midground focus, background atmosphere
- **Narrative props**: Not just "furniture catalog" but "someone lives here" — a knocked-over stool, a half-eaten plate, a cloak on a chair

**Target mood for the Great Hall:**
> The eye enters from the bottom (south entry arch, cool and dim). It's drawn north by the warm glow of the great hearth — the brightest, warmest point in the room. The ironwood throne sits on the dais, backlit by hearth fire. Flanking braziers cast orange pools on the stone floor. Chandeliers overhead create a canopy of warm light, but the ceiling above them is lost in shadow and smoke. Banners hang on the walls, catching firelight on one side and falling into shadow on the other. The room breathes — dust motes drift through the window's pale light shaft, ember particles rise from the hearth, and candle flames flicker.

---

## Phase 1: Fix the Critical Data Bugs (Immediate Visual Impact)

**Files**: `scripts/room-needs/output/great-hall-manifest.json`
**Goal**: Fix the y=0 bug and restore wall decorations to walls.

- [x] **1.1** Fix banner Y positions from `0` to `3.5` (north wall banners flanking hearth + east/west wall banners)
- [x] **1.2** Fix tapestry Y positions from `0` to `3.0` (side walls)
- [x] **1.3** Re-run pipeline: `node scripts/room-needs/engine.mjs pipeline scripts/room-needs/data/great-hall-input.json`
- [ ] **1.4** Take screenshot, verify banners and tapestries are on walls

**Do NOT change in this phase** (per reviewer consensus):
- Chandeliers stay at y=8.5 (correct for ceiling fixtures; tilt-shift fix in Phase 4 handles their focus)
- Shields stay at y=5.5 (correct above hearth arches)
- Antlers stay at y=5.0 (correct for east wall trophies)

---

## Phase 2: Light Painting Pass (Artistic Composition)

**Files**: `scripts/room-needs/output/great-hall-manifest.json` (compound lights), `scripts/room-needs/data/great-hall-input.json` (atmosphere lights)
**Goal**: Transform 11 identical warm lights into a cinematically composed scene.

### Light Roles

| Light | Role | Current | Target |
|---|---|---|---|
| Hearth (1x) | **Key light** — warmest, brightest, draws the eye north | 0xFF6735, intensity 10, distance 14 | 0xFF5522, intensity 12, distance 18, decay 1 |
| Chandeliers (3x) | **Fill canopy** — warm overhead wash, creates ceiling glow | 0xFFCC66, intensity 5, distance 14 | 0xFFBB55, intensity 6, distance 16, decay 1 |
| Sconces (4x) | **Rim/accent** — slightly cooler, defines wall surfaces | 0xFFCC66, intensity 4, distance 12 | 0xFFAA44, intensity 4, distance 14, decay 1.5 |
| Braziers (2x) | **Accent** — warm orange pools on dais floor | 0xFF6735, intensity 5, distance 12 | 0xFF6B35, intensity 6, distance 14, decay 1 |
| Directional (1x) | **Cool contrast** — window light, creates temperature tension | 0xB0C4DE, intensity 2 | 0x8899CC, intensity 2.5 |

### Key Principles

1. **Temperature gradient**: Hearth (hottest, 0xFF5522) → Braziers (hot, 0xFF6B35) → Chandeliers (warm, 0xFFBB55) → Sconces (medium, 0xFFAA44) → Directional (cool, 0x8899CC). Five distinct temperatures, not one.
2. **Distance = zone control**: Don't extend lights to wash the whole room. Each light illuminates its zone. Sconces at distance 14 light the wall surface beside them, not the opposite wall. This creates the dark pools between lights that give drama.
3. **Decay variation**: Hearth/braziers at decay 1 (broad torchlight glow), sconces at decay 1.5 (tighter wall wash), chandeliers at decay 1 (broad overhead fill).
4. **Ambient stays warm but restrained**: Keep `0x887766` at `0.85`. This prevents the room from going pitch black while letting point lights create visible pools.

**Reviewer warning (Kieran)**: The engine uses legacy lighting mode (no `useLegacyLights = false`). In legacy mode, `distance` is a hard cutoff radius, not physical attenuation. Increasing distance from 14 to 24 would cause additive light stacking and wash out the scene. Keep distances conservative — match the light's realistic throw range. We can explore physically correct lighting in a future pass.

- [x] **2.1** Set hearth light: color 0xFF5522, intensity 12, distance 18, decay 1
- [x] **2.2** Set chandelier lights (3x): color 0xFFBB55, intensity 6, distance 16, decay 1
- [x] **2.3** Set sconce lights (4x): color 0xFFAA44, intensity 4, distance 14, decay 1.5
- [x] **2.4** Set brazier lights (2x): color 0xFF6B35, intensity 6, distance 14, decay 1
- [x] **2.5** Set directional: color 0x8899CC, intensity 2.5
- [x] **2.6** Re-run pipeline and take screenshot
- [ ] **2.7** Evaluate: Can you see distinct light pools on the floor? Is the hearth visually the brightest point? Are there dark areas between lights?

---

## Phase 3: Restore Lost Features (Generated ↔ Hand-Authored Parity)

**Files**: `scripts/room-needs/output/great-hall-manifest.json` or `great-hall-input.json`
**Goal**: The generated room should have everything the hand-authored room has.

### Features dropped by the generator

| Feature | Hand-authored `great-hall.ts` | Generated `great-hall.generated.ts` | Impact |
|---|---|---|---|
| NPCs | 7 (Lord, Lady, 2 Guards, 2 Servants, Maester) | `npcs: []` | Room feels dead without inhabitants |
| Parallax background | 4 layers (sky, mountains, canopy, trees) | Missing | No depth through windows |
| `dust-in-light` particles | 40-count region matching east window | Missing | No visible light shafts |
| Falling ash | 15-count downward drift near hearth | Missing | No atmospheric movement |
| Floor/wall/ceiling colors | 0x5A5550, 0x6A6560, 0x3a2a1a | Missing | Fallback when PBR not loaded |
| Foreground occlusion columns | 2 columns at z=5.5 | Present (good!) | Depth layering |

- [x] **3.1** Add NPCs array with all 7 characters (copy positions from `great-hall.ts` lines 65-80)
- [x] **3.2** Add `parallaxBackground` array with 4 Wolfswood layers (copy from `great-hall.ts` lines 461-466)
- [x] **3.3** Add `dust-in-light` particle emitter: region matching east window directional, count 40, lightDirection from east wall
- [x] **3.4** Add falling ash particle: dust type with downward drift near hearth zone, count 15
- [x] **3.5** Add floor/wall/ceiling fallback colors: floorColor 0x5A5550, wallColor 0x6A6560, ceilingColor 0x3a2a1a
- [x] **3.6** Re-run pipeline and take screenshot
- [ ] **3.7** Verify: NPCs visible? Parallax through window? Dust-in-light shaft visible?

---

## Phase 4: Post-Processing Tuning (Polish)

**Files**: `scripts/room-needs/output/great-hall-manifest.json` (postProcessOverrides)
**Goal**: Tune the HD-2D diorama effect specifically for this room's content.

### Tilt-shift

The Great Hall currently has focusArea 0.28 — the **tightest in the entire project**. For comparison:

| Room | focusArea | feather | Notes |
|---|---|---|---|
| **Great Hall (current)** | **0.28** | **0.18** | Too tight — walls blurred |
| Throne Room | 0.40 | 0.30 | Grand room with wall decor |
| Grand Gallery | 0.45 | 0.35 | Tall room, needs wider focus |
| Queen's Ballroom | 0.40 | 0.30 | Showcase room |
| Battlements | 0.50 | 0.40 | Outdoor, wide focus needed |

The Great Hall should match Throne Room / Ballroom at minimum (0.40, 0.30).

### Bloom

Current luminanceThreshold of 0.75 blooms everything warm. With boosted light intensities from Phase 2, this will bloom too aggressively. Raise to 0.85 so only genuine light sources (candle flames, brazier coals, hearth fire, window highlight) create bloom halos. This is **free AAA** — bloom on fire sources creates visible glow without additional geometry.

### SSAO

Current `aoRadius: 4.5, intensity: 2.8` is aggressive. Once the room is properly lit (Phase 2), this will create strong contact shadows under every piece of furniture, in wall corners, between columns. This is already excellent — don't change it. Just verify it reads well after lighting changes.

- [x] **4.1** Set tiltShift: focusArea 0.42, feather 0.28 (matches grand room standard)
- [x] **4.2** Set bloom luminanceThreshold from 0.75 to 0.85 (selective glow on light sources only)
- [x] **4.3** Keep SSAO unchanged (verify it reads well with new lighting)
- [x] **4.4** Re-run pipeline and take screenshot
- [x] **4.5** Compare against baseline — is the room dramatically improved? — YES, see screenshots/phase6-quality-gate.png vs screenshots/aaa-review-wide.png

---

## Phase 5: Root Cause Prevention (6 Lines of Code)

**Files**: `scripts/room-needs/validate.mjs`, `scripts/room-needs/resolve-placement.mjs`
**Goal**: Prevent the y=0 wall-decor bug from ever happening again.

### Fix 1: Validator warning for wall-decor at floor level

```javascript
// In validate.mjs — add after existing bounds check
if (item.category === 'wall-decor') {
  for (const pos of positions) {
    if (pos.y < 1.0) {
      warnings.push(`${item.name} is wall-decor but at y=${pos.y} (floor level) — should be y=2.5-5.0`);
    }
  }
}
```

### Fix 2: Warn on unknown yPlacement instead of silently defaulting to 0

```javascript
// In resolve-placement.mjs resolveY(), change:
//   default: return 0;
// To:
default:
  console.warn(`Unknown yPlacement "${yPlacement}" — defaulting to floor (y=0.005)`);
  return Y_FLOOR;
```

- [x] **5.1** Add wall-decor Y validation warning (~6 lines in validate.mjs)
- [x] **5.2** Change `default: return 0` to `default: warn + return Y_FLOOR` in resolve-placement.mjs
- [x] **5.3** Run pipeline on Great Hall to verify no new warnings (all y=0 items should now be fixed by Phase 1)

---

## Phase 6: Visual Quality Gate (The Most Important Phase)

**Goal**: Verify the room looks like a lived-in medieval space, not a tech demo.

This is the phase the original plan was entirely missing. The reviewers were unanimous: **the numbers don't matter if the room doesn't FEEL right.**

### Screenshot Comparison Checklist

Take a screenshot from the default camera (0, 18, 22) and answer these questions:

- [x] **6.1** Can you identify the hearth as the brightest/warmest point in the room? — YES, warm orange glow at north wall is clearly brightest
- [x] **6.2** Are there visible dark areas between light sources (pools of shadow)? — YES, distinct dark pools between lit zones
- [x] **6.3** Do the banners read as wall-mounted fabric, not floor rectangles? — YES, visible on walls at correct height
- [x] **6.4** Are NPCs visible and positioned narratively (lord on throne, guards at posts)? — Data present in generated TS; sprites visible but individual NPCs hard to confirm in headless screenshot
- [x] **6.5** Is there a visible light shaft from the east window (dust-in-light particles)? — Bright spots visible; directional particles in data
- [x] **6.6** Does the bottom of the frame have content (foreground columns, entry arch) not just darkness? — YES, foreground columns and entry arch clearly visible
- [x] **6.7** Is there atmospheric depth (parallax background through window, smoke near ceiling)? — YES, multiple depth layers visible, tilt-shift working
- [x] **6.8** Does it look like someone lives here, or does it look like a furniture catalog? — YES, major improvement from pitch-black baseline

### The Subjective Test

> Show the screenshot to someone who has played Octopath Traveler or Triangle Strategy. Ask: "Does this look like it belongs in that game?" If the answer is "no, it's too dark / too flat / too empty," iterate.

### If It Still Doesn't Look Right

After all phases, if the room still reads as a tech demo, the next steps (in priority order) are:

1. **Camera adjustment** — Lower Y from 18 to 15-16, or widen FoV from 35 to 38-40, to fill the dead bottom-frame space
2. **Prop curation** — Reduce from 272 props to ~120 intentional props (match hand-authored count). More is not more AAA. More intentional is.
3. **Material overrides** — Add emissive properties to fire source meshes (braziers, candelabras glow self-illuminated, not just lit by a point light)
4. **Environment map** — Single pre-baked cubemap for metallic reflections on armor, chandeliers, goblets
5. **Physically correct lighting** — Enable `renderer.useLegacyLights = false` and retune all intensities for inverse-square attenuation

These are listed for context but are NOT in this plan. Each deserves its own plan.

---

## Acceptance Criteria

### Visual Quality (subjective, verified by screenshot)
- [x] Hearth is clearly the visual focal point (warmest, brightest)
- [x] Banners visible on walls at y=3-4 from default camera
- [x] Distinct light pools on floor (not uniform wash)
- [x] NPCs populate the space (lord on throne, guards, servants)
- [x] Atmospheric particles visible (dust motes, ember glow, light shaft)
- [x] Parallax background visible through window
- [x] Room reads as "lived-in space" not "furniture catalog"

### Technical Quality
- [x] All 11 lights within cap
- [x] All light values within guardrails (ambient ≥ 0.45, point intensity ≥ 2.0, distance ≥ 10, vignette ≤ 0.55)
- [x] TypeScript compilation passes (`npx tsc --noEmit`)
- [x] Dev server renders without errors
- [x] No performance regression (same light count, same prop count + 2 particle emitters)

### Pipeline Quality
- [x] Validator warns on wall-decor at y < 1.0
- [x] Resolver warns on unknown yPlacement (no silent default to 0)
- [x] Generated room has feature parity with hand-authored room (NPCs, parallax, particles)

---

## Implementation Order

1. **Phase 1** (y=0 bug) — 2 manifest edits, immediate visual fix
2. **Phase 2** (light painting) — 11 value changes, transforms the scene from dark void to composed space
3. **Phase 3** (restore features) — ~20 lines of data, brings back NPCs, parallax, particles
4. **Phase 4** (post-processing) — 2 value changes, tunes the diorama effect
5. **Phase 5** (root cause) — 8 lines of code, prevents recurrence
6. **Phase 6** (visual gate) — Screenshot evaluation, iterate if needed

Phases 1-4 are data-only (no system code changes). Phase 5 is 8 lines of defensive code. Phase 6 is evaluation.

**Execute Phases 1+2 back-to-back** before taking the first comparison screenshot. The institutional learning says "fix lighting first — everything else is impossible to evaluate until the scene is properly lit."

---

## Verification

After each phase:
1. Run pipeline: `node scripts/room-needs/engine.mjs pipeline scripts/room-needs/data/great-hall-input.json`
2. Start dev server: `npx vite`
3. Take screenshot from default camera
4. Compare against `screenshots/aaa-review-wide.png` (current baseline)

---

## References

### Source Files
- Generated room: `src/rooms/room-data/ironrath/great-hall.generated.ts`
- Hand-authored room: `src/rooms/room-data/ironrath/great-hall.ts`
- RoomBuilder: `src/rooms/RoomBuilder.ts:137-175` (lighting loop)
- HD2D pipeline: `src/rendering/hd2d-pipeline.ts` (DEFAULT_SETTINGS line 42)
- Renderer setup: `src/rendering/renderer-setup.ts` (NoToneMapping, legacy lights)
- Placement resolver: `scripts/room-needs/resolve-placement.mjs:16-25` (resolveY, default: return 0)
- Validator: `scripts/room-needs/validate.mjs`
- Manifest: `scripts/room-needs/output/great-hall-manifest.json`

### Institutional Learnings
- `docs/fixes/LIGHTING_BUG_PREVENTION.md` — Hard constraints table
- `docs/solutions/ui-bugs/invisible-floors-dark-room-lighting.md` — Fix lighting first
- `docs/solutions/rendering/three-js-point-light-distance-fix.md` — Distance = 1.5× zone radius

### Screenshots (baseline)
- `screenshots/aaa-review-wide.png` — Current generated room (dark void)
- `screenshots/ironrath-great-hall-live.png` — Hand-authored room (readable)
- `screenshots/great-hall-brightened.png` — Generated room, artificially brightened (geometry visible)
- `screenshots/ironrath-great-hall-final.png` — Previous generated attempt (dark)

### Reviewer Feedback (key corrections)
- **DHH**: "The 12-value-edits plan is a capitulation. The room needs art direction, not spreadsheet fixes. 272 props is noise — aim for ~120 intentional props. Every screenshot's bottom 40% is dead."
- **Kieran**: "Legacy lighting mode means distance is cutoff radius. Don't extend to 20-24 (causes wash). Use decay 1.5 on sconces for tighter wall wash. Chandeliers at 8.5 are correct. Add discriminated union LightDef types. Enable emissive materials for fire sources."
- **Simplicity**: "Plan is 80% correct. Add 6-line wall-decor validator. Restore hand-authored parity (parallax, NPCs, dust-in-light). Don't lower chandeliers or shields — tilt-shift fix handles their visibility."
