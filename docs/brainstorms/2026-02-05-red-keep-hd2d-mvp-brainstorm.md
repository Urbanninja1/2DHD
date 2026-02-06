# HD-2D Red Keep MVP — Brainstorm

**Date:** 2026-02-05
**Status:** Complete

---

## What We're Building

A top-down HD-2D RPG MVP set in a fictional version of the Red Keep from Game of Thrones. The sole goal of this MVP is to be **visually stunning** — a player walks through 10 architecturally coherent, life-size rooms of the Throne Room wing, surrounded by static NPC sprites, in a cinematic HD-2D presentation.

No combat. No dialogue. No inventory. Just a breathtaking scene you can walk through.

### Core Pillars

1. **Beauty first.** Every technical decision serves the visuals. Volumetric lighting, depth-of-field, bloom, particle effects (dust motes, torch flicker), rich textures.
2. **Architectural realism.** The 10 rooms connect spatially as they would in a real castle wing. You could draw a floor plan.
3. **HD-2D hybrid style.** 3D environments with full lighting/shader pipeline. 2D hand-painted/illustrated character sprites rendered as flat billboards in the 3D world.

---

## Why This Approach

### Tech Stack: Three.js + Becsy ECS

- **Three.js** — Industry-standard WebGL renderer. Full control over shaders, post-processing, and the render loop. Massive ecosystem.
- **Becsy** — High-performance ECS with TypeScript support and future multi-threading via SharedArrayBuffer. More powerful than bitECS, strong typing, good for scaling beyond MVP.
- **No React layer.** Direct Three.js for maximum control over the HD-2D visual pipeline.

### Visual Style: Custom Hybrid HD-2D

- **3D environments** built from free/open-source assets + custom shaders to achieve the HD-2D look.
- **2D character sprites** as flat textured planes (billboards) placed in the 3D scene.
- **3/4 angle camera** — the signature HD-2D tilted perspective with tilt-shift depth-of-field.
- **Atmosphere contrast** — Grand, majestic public rooms (Throne Room, Ballroom) vs. dark, foreboding private spaces (Guard Post, Stairwell, Holdfast).

### Asset Strategy

- Free texture packs (stone, wood, fabric, metal) from OpenGameArt, Poly Haven, ambientCG.
- Open-source 3D models (furniture, props) from Poly Pizza, Sketchfab CC0.
- Custom GLSL shaders for the HD-2D post-processing pipeline (DoF, bloom, vignette, color grading).
- Placeholder or AI-generated 2D sprites for NPCs.

---

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| ECS framework | Becsy | Strong typing, multi-thread future, scales beyond MVP |
| Rendering | Vanilla Three.js (no R3F) | Maximum control over HD-2D pipeline |
| Camera | Fixed 3/4 angle with DoF | Signature HD-2D look |
| Character rendering | 2D sprites as 3D billboards | Manageable art production, iconic HD-2D feel |
| NPC behavior | Static (no animation, no interaction) | MVP focuses on environment beauty |
| Room scope | Throne Room wing (10 connected rooms) | Spatially coherent, architecturally real |
| Asset sourcing | Free/open + custom shaders | Fast to look polished without original art |
| Atmosphere | Mixed: grand public + dark private | Dynamic exploration feel |
| Audio | None (visuals only) | Keep MVP scope tight, add audio later |
| Sprite style | Pixel art (16-32px) | Classic HD-2D look, easiest to source free assets |
| Room transitions | Fade to black | Simple, reliable, classic RPG feel |
| Platform target | Desktop browsers only | Full post-processing pipeline without mobile constraints |

---

## The Throne Room Wing — 10 Rooms

A spatially coherent layout centered on the Iron Throne Room:

| # | Room | Mood | Description |
|---|---|---|---|
| 1 | **Iron Throne Room** | Grand / Imposing | Massive hall. Iron Throne on raised dais. Tall stained-glass windows. Stone columns lining both sides. Shafts of colored light. |
| 2 | **Throne Room Antechamber** | Formal / Tense | Entry hall where petitioners wait. Kingsguard statues. Heavy oak doors. Banners. |
| 3 | **Small Council Chamber** | Intimate / Political | The iconic painted table. Candelabras. Maps on walls. Warm candlelight. |
| 4 | **Hand's Solar** | Studious / Warm | Tower of the Hand office. Books, scrolls, a hearth. Window overlooking the city. |
| 5 | **Grand Gallery** | Majestic / Airy | Long columned hallway with arched windows. Tapestries depicting Targaryen conquest. Natural light streaming in. |
| 6 | **Royal Guard Post** | Martial / Stark | Armor stands, weapon racks, a brazier. Cold stone. Functional, not decorative. |
| 7 | **Maegor's Holdfast Entry** | Foreboding / Heavy | Drawbridge passage to the inner keep. Thick walls. Murder holes above. Torchlit. |
| 8 | **Queen's Ballroom** | Elegant / Intimate | Smaller ornate hall. Gilded fixtures. A raised musician's gallery. Polished stone floor. |
| 9 | **Tower Stairwell** | Claustrophobic / Mysterious | Spiral stone stairs. Narrow arrow-slit windows. Echoing footsteps. Torch shadows dancing on curved walls. |
| 10 | **Battlements Overlook** | Open / Dramatic | Outdoor walkway. Panoramic parallax background of King's Landing rooftops and Blackwater Bay. Wind particles. Distant sounds. |

### Connectivity Map

```
                    [10. Battlements]
                          |
                    [9. Tower Stairwell]
                          |
[4. Hand's Solar] -- [5. Grand Gallery] -- [6. Guard Post]
                          |
[3. Small Council] -- [1. THRONE ROOM] -- [7. Maegor's Entry]
                          |
                    [2. Antechamber]
                          |
                    [8. Queen's Ballroom]
```

---

## HD-2D Visual Pipeline (Post-Processing Stack)

The "HD-2D look" is achieved through a specific post-processing chain:

1. **Tilt-shift depth-of-field** — Sharp focus on player area, blur on near/far elements. Creates the diorama/miniature effect.
2. **Bloom** — Soft glow on light sources (windows, torches, candles). Makes lighting feel warm and cinematic.
3. **Vignette** — Subtle darkening at screen edges. Draws focus to center.
4. **Color grading** — Per-room color palette. Warm golds for the Throne Room, cool blues for the Battlements, amber for torch-lit corridors.
5. **Ambient occlusion (SSAO)** — Deepens shadows in corners and crevices. Adds depth to stone architecture.
6. **Particle systems** — Dust motes in light shafts, ember particles near torches, rain/wind on battlements.
7. **Dynamic lighting** — Point lights for torches/candles with subtle flicker. Directional light for windows. Volumetric god rays where possible.

---

## Player Character

- 2D sprite rendered as a billboard in the 3D scene
- Free 8-directional movement (WASD / arrow keys)
- Camera follows player with smooth interpolation
- Room transitions triggered by walking through doorways (fade or scroll transition)

---

## Resolved Questions

- **Audio:** No — visuals only for MVP. Audio is a future enhancement.
- **Sprite style:** Pixel art (16-32px) — classic HD-2D aesthetic, like Octopath Traveler.
- **Room transitions:** Fade to black — simple, reliable, classic RPG feel.
- **Performance target:** Desktop browsers only (Chrome/Firefox/Edge). Full post-processing pipeline.

---

## Next Steps

Run `/workflows:plan` to create the implementation plan for this MVP.
