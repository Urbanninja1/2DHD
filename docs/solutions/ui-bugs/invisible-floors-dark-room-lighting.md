---
title: "Fix Invisible Floors in Antechamber, Guard Post, and Maegor's Entry"
date: 2026-02-08
category: ui-bugs
tags:
  - lighting
  - color-grading
  - post-processing
  - floor-visibility
  - vignette
  - ambient-light
module: rooms/room-data
severity: medium
symptoms:
  - Antechamber floor completely black/invisible
  - Guard Post floor appears as black void
  - "Maegor's Entry floor not visible — characters float in darkness"
  - Floor geometry exists but is not rendered visibly
affected_rooms:
  - 02-antechamber.ts
  - 06-guard-post.ts
  - 07-maegor-entry.ts
commit: 6e726f7
resolved: true
---

## Problem

Three of ten rooms in the Red Keep dungeon crawler had invisible floors. Players appeared to float in a black void with only light sources and NPCs visible. The affected rooms were:

- **Room 2** — Throne Room Antechamber
- **Room 6** — Royal Guard Post
- **Room 7** — Maegor's Holdfast Entry

Floor and wall geometry existed in the scene but was rendered so dark it was indistinguishable from the background.

## Investigation

1. Automated screenshots of all 10 rooms were captured using Playwright
2. Rooms with visible floors (Throne Room, Queen's Ballroom) were compared against broken rooms
3. Room data config files were diffed side-by-side to find systematic differences

**Key comparison — working vs broken rooms:**

| Setting | Throne Room (works) | Queen's Ballroom (works) | Guard Post (broken) | Maegor's Entry (broken) |
|---------|--------------------|-----------------------|--------------------|-----------------------|
| ambientLight.intensity | 0.6 | 0.55 | **0.35** | **0.3** |
| colorGrading.brightness | 0 | 0 | **-0.1** | **-0.1** |
| vignette.darkness | 0.40 | 0.40 | **0.60** | **0.65** |
| floorColor | 0x3a3a3a | 0x1A1018 | **0x2A2A2A** | **0x252525** |

## Root Cause

Four compounding factors crushed floor visibility to black:

1. **Negative brightness in color grading** — `postProcessOverrides.colorGrading.brightness` set to -0.05 to -0.1, actively darkening an already dim scene
2. **Insufficient ambient light** — intensity of 0.3–0.35 vs 0.55–0.6 in working rooms
3. **Aggressive vignette** — darkness of 0.60–0.65 vs 0.40 in working rooms, crushing edges
4. **Very dark floor base colors** — hex values near black (0x252525) with no light to reveal them

Each factor alone might be survivable, but stacked together they eliminated all floor visibility.

## Solution

### Room 2 — Antechamber (`02-antechamber.ts`)

```diff
- ambientLight: { color: 0x665544, intensity: 0.5 },
+ ambientLight: { color: 0x665544, intensity: 0.6 },

- colorGrading: { hue: 0.175, saturation: 0.15, brightness: -0.05, contrast: 0.05 },
+ colorGrading: { hue: 0.175, saturation: 0.15, brightness: 0, contrast: 0.05 },
```

### Room 6 — Guard Post (`06-guard-post.ts`)

```diff
- floorColor: 0x2A2A2A,
- wallColor: 0x3A3A3A,
+ floorColor: 0x3A3530,
+ wallColor: 0x4A4540,

- ambientLight: { color: 0x2A2A3E, intensity: 0.35 },
+ ambientLight: { color: 0x2A2A3E, intensity: 0.55 },

- vignette: { darkness: 0.60 },
- colorGrading: { hue: -0.087, saturation: -0.1, brightness: -0.1, contrast: 0.15 },
+ vignette: { darkness: 0.40 },
+ colorGrading: { hue: -0.087, saturation: -0.05, brightness: 0, contrast: 0.1 },
```

### Room 7 — Maegor's Entry (`07-maegor-entry.ts`)

```diff
- floorColor: 0x252525,
+ floorColor: 0x353030,

- ambientLight: { color: 0x2A2A3E, intensity: 0.3 },
+ ambientLight: { color: 0x2A2A3E, intensity: 0.5 },

- vignette: { darkness: 0.65 },
- colorGrading: { hue: -0.087, saturation: -0.1, brightness: -0.1, contrast: 0.15 },
+ vignette: { darkness: 0.40 },
+ colorGrading: { hue: -0.087, saturation: -0.05, brightness: 0, contrast: 0.1 },
```

## Verification

All 10 rooms were re-screenshotted after the fix. The three fixed rooms now show:
- Visible floor textures (rough stone, mossy stone)
- Visible wall geometry
- Maintained dark/moody atmosphere appropriate to their mood setting
- No regression in the 7 previously-working rooms

## Prevention

- **Never use negative brightness** in `colorGrading` — use lower ambient light instead for mood
- **Ambient light minimum**: 0.45 intensity for any room
- **Vignette darkness maximum**: 0.50 — above this, edges become unreadable
- **Floor color minimum**: no channel below 0x30 (e.g., `0x303030`)
- **Always compare** new room configs against working rooms before shipping

## Related

- [Particle Scale and Room Lighting Overhaul](./particle-scale-and-room-lighting-overhaul.md) — earlier pass that boosted all 10 rooms
- [HD-2D Deferred Effects Pipeline](../architecture/hd2d-deferred-effects-pipeline.md) — post-processing architecture
- [Data-Driven Room System](../architecture/data-driven-room-system-pattern.md) — room config structure
- Commit `f8c7cf9` — prior lighting intensity boost across all rooms
- Commit `6e726f7` — this fix
