# Brainstorm: Autonomous Blender Asset Pipeline

**Date:** 2026-02-08
**Status:** Ready for planning

## What We're Building

An autonomous asset creation pipeline powered by Blender (headless, bpy scripting) that Claude can drive end-to-end to generate production-quality 3D models and PBR textures for the 2DHD project. The north star: **"build an entire castle in one shot."**

The pipeline replaces the current `generate-ironrath-props.mjs` approach (Three.js CSG with procedural textures) with Blender-based generation that produces:
- Clean low-poly models (Octopath-level, ~500-2000 tris)
- Baked PBR texture sets (diffuse, normal, roughness, AO) at 2K resolution
- Proper UV layouts for tiling and detail
- GLB export ready for the existing room loading system

The Great Hall is the proving ground — first room to receive the full pipeline treatment.

## Why This Approach

### The Problem (Honest Assessment)
The current Great Hall is at ~50-55% quality:
- **Textures:** Procedural-only, 128-256px, no normal maps. Floor and walls use the same texture set. Ceiling has no texture at all.
- **Geometry:** Box/cylinder primitives with CSG. Simple silhouettes, no sculpted detail.
- **Architecture:** Flat walls, no windows, no roof beams, no alcoves. Room feels like a box with props inside.
- **Consistency:** Generic stone/wood materials shared across all rooms. No Ironrath identity.
- **Scalability:** Current script is 25 inline generator functions. Adding another room means copy-pasting and tweaking — doesn't scale to a full castle.

### Why Blender
- **Geometry:** Proper mesh operations, modifiers (bevel, subdivision, boolean), sculpting tools — all scriptable via bpy
- **Materials:** Procedural shader nodes (Musgrave, Voronoi, Wave, etc.) produce genuinely good stone/wood/metal. Can layer CC0 photo textures on top.
- **Baking:** Native PBR bake pipeline (diffuse, normal, roughness, AO) from high-poly to low-poly or from procedural nodes to UV maps
- **Automation:** Headless mode (`blender --background --python script.py`) — no GUI needed, fully CLI-driven
- **Scalability:** Parameterized scripts can generate variations. Same stone-wall script with different seed/scale = different room.

### Why Not Alternatives
- **Enhanced Three.js procedural:** Fundamentally limited — no normal map baking, no proper booleans, geometry ceiling is low
- **AI texture generation:** Variable quality, inconsistent style, requires API access
- **Sourcing CC0 models:** Hard to allocate/match across entire castle, doesn't scale autonomously

## Key Decisions

1. **Blender installed headless on user's machine** — Claude drives it via `blender --background --python` commands. No GUI interaction.

2. **Octopath-level quality target** — Clean low-poly with good silhouettes and baked normals (~500-2000 tris per prop). Room to go higher if needed.

3. **PBR texture baking from Blender procedurals + CC0 photos** — Procedural nodes for base materials (stone grain, wood pattern, metal scratches), supplemented with real photographic textures from CC0 sources where it adds realism.

4. **2K resolution PBR maps** — Diffuse, Normal, Roughness, AO for every surface. Massive upgrade from current 128-256px procedural-only.

5. **Great Hall as proving ground** — Build pipeline, immediately test on Great Hall assets. Iterative: build minimal pipeline → test on a few assets → improve → repeat.

6. **Pipeline must scale to full castle** — Architecture designed so adding a new room is parameterized, not copy-paste.

## What the Pipeline Produces

### Per Model
- `.glb` file with embedded materials (or external textures referenced)
- Baked PBR texture set: `{name}_diffuse.png`, `{name}_normal.png`, `{name}_roughness.png`, `{name}_ao.png`
- Metadata (tri count, texture resolution, bounding box) for budgeting

### Per Room Surface
- Floor, wall, ceiling texture sets (2K PBR)
- Unique per-room with consistent Ironrath palette

### Asset Categories Needed for Great Hall
| Category | Current Count | Target Count | Gap |
|----------|--------------|-------------|-----|
| Structural (columns, arches, pilasters) | 3 | 8-10 | +5-7 |
| Furniture (tables, chairs, thrones) | 5 | 8-10 | +3-5 |
| Wall architecture (windows, niches, doors) | 0 | 5-6 | +5-6 |
| Roof/ceiling (beams, joists, rafters) | 0 | 3-4 | +3-4 |
| Decorative (banners, tapestries, shields, heraldry) | 3 | 8-10 | +5-7 |
| Lighting fixtures | 3 | 4-5 | +1-2 |
| Tabletop items | 3 | 5-6 | +2-3 |
| Floor detail (worn paths, drains, stone patterns) | 4 | 6-8 | +2-4 |
| Surface textures (floor, walls, ceiling) | 1 (reused) | 3-4 unique | +2-3 |

## Open Questions

1. **Blender version:** Which version to install? Latest stable (4.x) for best bpy API?
2. **Texture format:** PNG for dev, KTX2 for production? Or bake directly to KTX2?
3. **Asset budget per room:** Hard limit on total tri count and texture memory?
4. **CC0 source strategy:** Pre-download a curated library of stone/wood/metal photos, or fetch on-demand per asset?
5. **Script organization:** One master script per room, or modular scripts per asset category?
6. **Existing GLBs:** Replace all 25 current Ironrath GLBs, or keep some and upgrade selectively?

## Scope Estimate

### Pipeline Infrastructure
- Install + configure Blender headless
- Build bpy utility library (mesh ops, material creation, UV unwrap, PBR bake, GLB export)
- Build parameterized generator scripts per asset category
- Build room composition script (takes room spec → generates all assets)

### Great Hall Overhaul
- Replace/upgrade ~25 existing props with Blender-generated versions
- Add ~20-25 new architectural/decorative assets
- Create 3-4 unique PBR surface texture sets
- Update `great-hall.ts` room data with new assets and improved layout

### Total New Assets Needed: ~45-50 models + 3-4 surface texture sets
