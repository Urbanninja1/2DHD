"""
Generate a single prop by name.

Usage:
  blender --background --factory-startup --python scripts/blender/generate_prop.py -- <prop-name>

Example:
  blender --background --factory-startup --python scripts/blender/generate_prop.py -- stone-hearth
"""
import bpy
import sys
import os
import time

# Add parent dir to path so we can import lib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lib.mesh_ops import (
    clean_scene, add_bevel, smooth_shade, smart_uv_unwrap,
    remove_doubles, join_objects, set_origin_base_center,
    create_cylinder_section, create_box,
)
from lib.materials import create_northern_stone, create_ironwood, create_dark_iron, create_leather
from lib.bake import bake_pbr, replace_material_with_baked
from lib.export import prepare_for_export, export_glb
from lib.conventions import (
    MODEL_OUTPUT_DIR, TEX_PROP_LARGE, TEX_PROP_SMALL,
    BUDGET_SMALL, BUDGET_MEDIUM, BUDGET_LARGE,
)

import bmesh
import math


# ═══════════════════════════════════════════════════════════════════════
# PROP GENERATORS — each returns the final object ready for baking
# ═══════════════════════════════════════════════════════════════════════

def gen_stone_hearth():
    """Stone fireplace with carved opening, chimney breast detail."""
    mesh = bpy.data.meshes.new('hearth_mesh')
    bm = bmesh.new()

    # Back wall slab
    create_box(bm, 4.0, 3.0, 0.4, z=0, y=-0.2)
    # Left pillar
    create_box(bm, 0.5, 3.0, 0.8, x=-2.0, z=0)
    # Right pillar
    create_box(bm, 0.5, 3.0, 0.8, x=2.0, z=0)
    # Mantel / lintel
    create_box(bm, 5.0, 0.4, 1.0, z=3.0)
    # Hearth floor
    create_box(bm, 3.5, 0.15, 0.8, z=0, y=0.1)
    # Chimney breast above mantel
    create_box(bm, 3.0, 2.0, 0.5, z=3.4, y=-0.1)
    # Firebox back (inner)
    create_box(bm, 2.8, 2.0, 0.2, z=0.15, y=-0.05)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('stone_hearth', mesh)
    bpy.context.collection.objects.link(obj)
    mat = create_northern_stone('HearthStone', scale=3.0)
    obj.data.materials.append(mat)
    return obj, TEX_PROP_LARGE


def gen_raised_dais():
    """Two-tier stone platform with edge steps."""
    mesh = bpy.data.meshes.new('dais_mesh')
    bm = bmesh.new()

    # Lower tier - wider
    create_box(bm, 6.0, 0.15, 4.0, z=0)
    # Upper tier - narrower
    create_box(bm, 5.0, 0.15, 3.5, z=0.15)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('raised_dais', mesh)
    bpy.context.collection.objects.link(obj)
    mat = create_northern_stone('DaisStone', scale=5.0)
    obj.data.materials.append(mat)
    return obj, TEX_PROP_LARGE


def gen_stone_arch():
    """Pointed arch for doorways and wall recesses."""
    mesh = bpy.data.meshes.new('arch_mesh')
    bm = bmesh.new()

    # Two vertical columns
    create_box(bm, 0.4, 3.0, 0.4, x=-1.2, z=0)
    create_box(bm, 0.4, 3.0, 0.4, x=1.2, z=0)

    # Arch top - approximated with angled segments
    arch_segments = 8
    arch_height = 1.0
    arch_width = 2.4
    arch_depth = 0.4
    for i in range(arch_segments):
        t0 = i / arch_segments
        t1 = (i + 1) / arch_segments
        angle0 = math.pi * t0
        angle1 = math.pi * t1
        x0 = -math.cos(angle0) * (arch_width / 2)
        z0 = 3.0 + math.sin(angle0) * arch_height
        x1 = -math.cos(angle1) * (arch_width / 2)
        z1 = 3.0 + math.sin(angle1) * arch_height
        # Each arch segment as a small box (approximate)
        cx = (x0 + x1) / 2
        cz = (z0 + z1) / 2
        seg_width = max(abs(x1 - x0), 0.15)
        seg_height = max(abs(z1 - z0), 0.15)
        create_box(bm, seg_width + 0.2, seg_height + 0.1, arch_depth, x=cx, z=cz)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('stone_arch', mesh)
    bpy.context.collection.objects.link(obj)
    mat = create_northern_stone('ArchStone', scale=4.0)
    obj.data.materials.append(mat)
    return obj, TEX_PROP_LARGE


def gen_stone_pilaster():
    """Wall-attached half-column for wall articulation."""
    mesh = bpy.data.meshes.new('pilaster_mesh')
    bm = bmesh.new()

    # Half-cylinder shape (flat back against wall)
    segments = 8
    radius = 0.25
    height = 3.5

    # Create half-cylinder verts
    verts_b = []
    verts_t = []
    for i in range(segments + 1):
        angle = math.pi * i / segments  # 0 to pi (half circle)
        x = radius * math.cos(angle)
        y = radius * math.sin(angle)
        verts_b.append(bm.verts.new((x, y, 0)))
        verts_t.append(bm.verts.new((x, y, height)))

    # Side faces
    for i in range(segments):
        bm.faces.new([verts_b[i], verts_b[i+1], verts_t[i+1], verts_t[i]])

    # Flat back face
    bm.faces.new(verts_b)
    bm.faces.new(list(reversed(verts_t)))

    # Base cap
    create_box(bm, 0.6, 0.3, 0.3, z=0)
    # Capital
    create_box(bm, 0.6, 0.3, 0.3, z=height)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('stone_pilaster', mesh)
    bpy.context.collection.objects.link(obj)
    mat = create_northern_stone('PilasterStone', scale=4.0)
    obj.data.materials.append(mat)
    return obj, TEX_PROP_LARGE


def gen_corbel_bracket():
    """Stone bracket supporting roof beams."""
    mesh = bpy.data.meshes.new('corbel_mesh')
    bm = bmesh.new()

    # Simple stepped bracket shape
    create_box(bm, 0.4, 0.3, 0.2, z=0)       # base
    create_box(bm, 0.5, 0.4, 0.2, z=0.3, y=0.05)  # step out
    create_box(bm, 0.6, 0.5, 0.15, z=0.7, y=0.1)   # wider support

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('corbel_bracket', mesh)
    bpy.context.collection.objects.link(obj)
    mat = create_northern_stone('CorbelStone', scale=6.0)
    obj.data.materials.append(mat)
    return obj, TEX_PROP_SMALL


def gen_stone_window_frame():
    """Mullioned window frame with stone surround."""
    mesh = bpy.data.meshes.new('window_mesh')
    bm = bmesh.new()

    # Outer frame
    frame_w, frame_h, frame_d = 2.0, 2.5, 0.3
    # Left
    create_box(bm, 0.2, frame_h, frame_d, x=-frame_w/2)
    # Right
    create_box(bm, 0.2, frame_h, frame_d, x=frame_w/2)
    # Top
    create_box(bm, frame_w + 0.2, 0.2, frame_d, z=frame_h)
    # Sill
    create_box(bm, frame_w + 0.4, 0.15, frame_d + 0.1, z=0)
    # Center mullion
    create_box(bm, 0.1, frame_h, 0.15, x=0)
    # Transom bar
    create_box(bm, frame_w, 0.1, 0.15, z=frame_h * 0.6)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('stone_window_frame', mesh)
    bpy.context.collection.objects.link(obj)
    mat = create_northern_stone('WindowStone', scale=3.0)
    obj.data.materials.append(mat)
    return obj, TEX_PROP_LARGE


def gen_door_frame():
    """Heavy oak door frame with iron studs feel."""
    mesh = bpy.data.meshes.new('door_mesh')
    bm = bmesh.new()

    # Door frame in ironwood
    frame_w, frame_h = 2.0, 3.5
    # Left post
    create_box(bm, 0.25, frame_h, 0.3, x=-frame_w/2)
    # Right post
    create_box(bm, 0.25, frame_h, 0.3, x=frame_w/2)
    # Lintel
    create_box(bm, frame_w + 0.3, 0.3, 0.35, z=frame_h)
    # Door planks (two halves)
    create_box(bm, 0.9, frame_h - 0.1, 0.08, x=-0.5, z=0.05)
    create_box(bm, 0.9, frame_h - 0.1, 0.08, x=0.5, z=0.05)
    # Cross braces
    create_box(bm, 1.8, 0.15, 0.12, z=0.8)
    create_box(bm, 1.8, 0.15, 0.12, z=2.2)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('door_frame', mesh)
    bpy.context.collection.objects.link(obj)
    mat = create_ironwood('DoorIronwood')
    obj.data.materials.append(mat)
    return obj, TEX_PROP_LARGE


def gen_ironwood_throne():
    """Throne with dire wolf carving detail, ironwood grain, leather cushion."""
    mesh = bpy.data.meshes.new('throne_mesh')
    bm = bmesh.new()

    # Seat
    create_box(bm, 1.2, 0.15, 1.0, z=1.0)
    # Backrest (tall)
    create_box(bm, 1.2, 2.0, 0.15, z=1.1, y=-0.425)
    # Armrests
    create_box(bm, 0.12, 0.6, 0.8, x=-0.54, z=1.1, y=0.05)
    create_box(bm, 0.12, 0.6, 0.8, x=0.54, z=1.1, y=0.05)
    # Front legs
    create_box(bm, 0.12, 1.0, 0.12, x=-0.5, z=0, y=0.4)
    create_box(bm, 0.12, 1.0, 0.12, x=0.5, z=0, y=0.4)
    # Back legs (taller)
    create_box(bm, 0.12, 3.0, 0.12, x=-0.5, z=0, y=-0.4)
    create_box(bm, 0.12, 3.0, 0.12, x=0.5, z=0, y=-0.4)
    # Crown detail on backrest
    create_box(bm, 0.8, 0.3, 0.18, z=2.9, y=-0.425)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('ironwood_throne', mesh)
    bpy.context.collection.objects.link(obj)
    mat = create_ironwood('ThroneIronwood')
    obj.data.materials.append(mat)
    return obj, TEX_PROP_LARGE


def gen_long_table():
    """Trestle table with cross-beams and worn surface."""
    mesh = bpy.data.meshes.new('table_mesh')
    bm = bmesh.new()

    table_w, table_h, table_d = 6.0, 0.12, 1.4
    leg_h = 0.9

    # Table top
    create_box(bm, table_w, table_h, table_d, z=leg_h)
    # Trestle legs (A-frame pairs at each end and middle)
    for x_pos in [-2.5, 0, 2.5]:
        # Legs
        create_box(bm, 0.1, leg_h, 0.1, x=x_pos - 0.5, z=0, y=-0.4)
        create_box(bm, 0.1, leg_h, 0.1, x=x_pos + 0.5, z=0, y=-0.4)
        create_box(bm, 0.1, leg_h, 0.1, x=x_pos - 0.5, z=0, y=0.4)
        create_box(bm, 0.1, leg_h, 0.1, x=x_pos + 0.5, z=0, y=0.4)
        # Cross beam
        create_box(bm, 1.2, 0.1, 0.1, x=x_pos, z=0.3)

    # Stretcher rails along length
    create_box(bm, table_w - 0.5, 0.08, 0.08, z=0.2, y=-0.4)
    create_box(bm, table_w - 0.5, 0.08, 0.08, z=0.2, y=0.4)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('long_table', mesh)
    bpy.context.collection.objects.link(obj)
    mat = create_ironwood('TableIronwood', grain_density=2.0)
    obj.data.materials.append(mat)
    return obj, TEX_PROP_LARGE


def gen_bench():
    """Simple bench with aged wood."""
    mesh = bpy.data.meshes.new('bench_mesh')
    bm = bmesh.new()

    # Seat plank
    create_box(bm, 2.0, 0.08, 0.4, z=0.45)
    # Legs (4x)
    create_box(bm, 0.08, 0.45, 0.08, x=-0.85, z=0, y=-0.12)
    create_box(bm, 0.08, 0.45, 0.08, x=0.85, z=0, y=-0.12)
    create_box(bm, 0.08, 0.45, 0.08, x=-0.85, z=0, y=0.12)
    create_box(bm, 0.08, 0.45, 0.08, x=0.85, z=0, y=0.12)
    # Stretcher
    create_box(bm, 1.7, 0.06, 0.06, z=0.15)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('bench', mesh)
    bpy.context.collection.objects.link(obj)
    mat = create_ironwood('BenchWood', grain_density=2.5)
    obj.data.materials.append(mat)
    return obj, TEX_PROP_LARGE


def gen_high_seat():
    """Wider chair with armrests."""
    mesh = bpy.data.meshes.new('seat_mesh')
    bm = bmesh.new()

    # Seat
    create_box(bm, 0.8, 0.1, 0.7, z=0.8)
    # Backrest
    create_box(bm, 0.8, 1.2, 0.1, z=0.85, y=-0.3)
    # Armrests
    create_box(bm, 0.08, 0.4, 0.5, x=-0.36, z=0.85, y=0.05)
    create_box(bm, 0.08, 0.4, 0.5, x=0.36, z=0.85, y=0.05)
    # Front legs
    create_box(bm, 0.08, 0.8, 0.08, x=-0.32, z=0, y=0.25)
    create_box(bm, 0.08, 0.8, 0.08, x=0.32, z=0, y=0.25)
    # Back legs
    create_box(bm, 0.08, 2.0, 0.08, x=-0.32, z=0, y=-0.25)
    create_box(bm, 0.08, 2.0, 0.08, x=0.32, z=0, y=-0.25)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('high_seat', mesh)
    bpy.context.collection.objects.link(obj)
    mat = create_ironwood('SeatIronwood')
    obj.data.materials.append(mat)
    return obj, TEX_PROP_LARGE


def gen_chair():
    """Small chair."""
    mesh = bpy.data.meshes.new('chair_mesh')
    bm = bmesh.new()

    create_box(bm, 0.5, 0.08, 0.5, z=0.55)
    create_box(bm, 0.5, 0.9, 0.08, z=0.6, y=-0.21)
    create_box(bm, 0.06, 0.55, 0.06, x=-0.2, z=0, y=0.18)
    create_box(bm, 0.06, 0.55, 0.06, x=0.2, z=0, y=0.18)
    create_box(bm, 0.06, 1.5, 0.06, x=-0.2, z=0, y=-0.18)
    create_box(bm, 0.06, 1.5, 0.06, x=0.2, z=0, y=-0.18)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('chair', mesh)
    bpy.context.collection.objects.link(obj)
    mat = create_ironwood('ChairWood', grain_density=2.5)
    obj.data.materials.append(mat)
    return obj, TEX_PROP_SMALL


def gen_sideboard():
    """Wall-side serving table."""
    mesh = bpy.data.meshes.new('sideboard_mesh')
    bm = bmesh.new()

    create_box(bm, 2.0, 0.1, 0.6, z=0.85)
    create_box(bm, 1.9, 0.85, 0.05, z=0, y=-0.275)  # back panel
    create_box(bm, 0.08, 0.85, 0.55, x=-0.9, z=0)     # left side
    create_box(bm, 0.08, 0.85, 0.55, x=0.9, z=0)      # right side
    create_box(bm, 1.8, 0.08, 0.5, z=0.4)              # shelf

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('sideboard', mesh)
    bpy.context.collection.objects.link(obj)
    mat = create_ironwood('SideboardWood')
    obj.data.materials.append(mat)
    return obj, TEX_PROP_LARGE


def gen_wooden_chest_large():
    """Large iron-banded storage chest."""
    mesh = bpy.data.meshes.new('chest_mesh')
    bm = bmesh.new()

    # Body
    create_box(bm, 1.2, 0.6, 0.6, z=0)
    # Lid (slightly raised)
    create_box(bm, 1.25, 0.1, 0.65, z=0.6)
    # Iron bands
    create_box(bm, 1.22, 0.05, 0.62, z=0.15)
    create_box(bm, 1.22, 0.05, 0.62, z=0.4)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('wooden_chest_large', mesh)
    bpy.context.collection.objects.link(obj)
    mat = create_ironwood('ChestWood')
    obj.data.materials.append(mat)
    return obj, TEX_PROP_LARGE


def gen_stool():
    """Three-legged stool."""
    mesh = bpy.data.meshes.new('stool_mesh')
    bm = bmesh.new()

    # Seat (cylinder)
    create_cylinder_section(bm, 0.2, 0.22, 0.06, 8, 0.45)
    # Three legs
    for i in range(3):
        angle = 2 * math.pi * i / 3
        x = 0.15 * math.cos(angle)
        y = 0.15 * math.sin(angle)
        create_box(bm, 0.04, 0.45, 0.04, x=x, y=y, z=0)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('stool', mesh)
    bpy.context.collection.objects.link(obj)
    mat = create_ironwood('StoolWood', grain_density=3.0)
    obj.data.materials.append(mat)
    return obj, TEX_PROP_SMALL


def gen_roof_beam():
    """Massive ironwood beam spanning the hall width."""
    mesh = bpy.data.meshes.new('beam_mesh')
    bm = bmesh.new()

    create_box(bm, 12.0, 0.5, 0.4, z=0)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('roof_beam', mesh)
    bpy.context.collection.objects.link(obj)
    mat = create_ironwood('BeamIronwood', scale=1.0, grain_density=2.0)
    obj.data.materials.append(mat)
    return obj, TEX_PROP_LARGE


def gen_roof_joist():
    """Smaller cross-beam between main beams."""
    mesh = bpy.data.meshes.new('joist_mesh')
    bm = bmesh.new()

    create_box(bm, 4.0, 0.25, 0.2, z=0)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('roof_joist', mesh)
    bpy.context.collection.objects.link(obj)
    mat = create_ironwood('JoistWood', grain_density=3.0)
    obj.data.materials.append(mat)
    return obj, TEX_PROP_LARGE


def gen_rafter_set():
    """Angled roof structure visible from below."""
    mesh = bpy.data.meshes.new('rafter_mesh')
    bm = bmesh.new()

    # Two angled rafters meeting at a peak
    create_box(bm, 0.15, 3.0, 0.12, x=-1.0, z=0)
    create_box(bm, 0.15, 3.0, 0.12, x=1.0, z=0)
    # Ridge beam at top
    create_box(bm, 0.15, 0.15, 3.0, z=2.8)
    # Collar tie
    create_box(bm, 2.0, 0.12, 0.12, z=1.5)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('rafter_set', mesh)
    bpy.context.collection.objects.link(obj)
    mat = create_ironwood('RafterWood')
    obj.data.materials.append(mat)
    return obj, TEX_PROP_LARGE


def gen_banner():
    """Cloth banner with drape folds."""
    mesh = bpy.data.meshes.new('banner_mesh')
    bm = bmesh.new()

    # Banner hanging rod
    create_box(bm, 1.2, 0.06, 0.06, z=2.5)
    # Banner cloth (flat quad with slight wave)
    create_box(bm, 1.0, 2.0, 0.02, z=0.5)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('banner', mesh)
    bpy.context.collection.objects.link(obj)

    # Red/grey Forrester colors
    mat = bpy.data.materials.new('BannerFabric')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    principled = nodes.get('Principled BSDF')
    principled.inputs['Base Color'].default_value = (0.5, 0.12, 0.08, 1.0)  # Deep red
    principled.inputs['Roughness'].default_value = 0.9
    principled.inputs['Metallic'].default_value = 0.0

    obj.data.materials.append(mat)
    return obj, TEX_PROP_LARGE


def gen_tapestry():
    """Larger woven hanging with geometric border."""
    mesh = bpy.data.meshes.new('tapestry_mesh')
    bm = bmesh.new()

    create_box(bm, 2.0, 2.5, 0.02, z=0.5)
    # Rod
    create_box(bm, 2.2, 0.06, 0.06, z=3.0)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('tapestry', mesh)
    bpy.context.collection.objects.link(obj)

    mat = bpy.data.materials.new('TapestryFabric')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    principled = nodes.get('Principled BSDF')
    principled.inputs['Base Color'].default_value = (0.35, 0.25, 0.15, 1.0)
    principled.inputs['Roughness'].default_value = 0.95

    obj.data.materials.append(mat)
    return obj, TEX_PROP_LARGE


def gen_weapon_rack():
    """Wall-mounted rack with sword/axe silhouettes."""
    mesh = bpy.data.meshes.new('rack_mesh')
    bm = bmesh.new()

    # Backboard
    create_box(bm, 1.5, 1.2, 0.06, z=0.8)
    # Pegs
    for x in [-0.5, 0, 0.5]:
        create_box(bm, 0.06, 0.06, 0.15, x=x, z=1.6)
        create_box(bm, 0.06, 0.06, 0.15, x=x, z=1.0)
    # Sword silhouettes (flat)
    create_box(bm, 0.06, 1.0, 0.02, x=-0.5, z=1.1, y=0.1)
    create_box(bm, 0.06, 0.8, 0.02, x=0.5, z=1.15, y=0.1)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('weapon_rack', mesh)
    bpy.context.collection.objects.link(obj)
    mat = create_ironwood('RackWood')
    obj.data.materials.append(mat)
    return obj, TEX_PROP_LARGE


def gen_dire_wolf_shield():
    """Forrester house shield."""
    mesh = bpy.data.meshes.new('shield_mesh')
    bm = bmesh.new()

    # Shield body (octagonal flat)
    create_cylinder_section(bm, 0.4, 0.4, 0.06, 8, 0)
    # Boss in center
    create_cylinder_section(bm, 0.08, 0.06, 0.04, 8, 0.06)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('dire_wolf_shield', mesh)
    bpy.context.collection.objects.link(obj)
    mat = create_dark_iron('ShieldIron')
    obj.data.materials.append(mat)
    return obj, TEX_PROP_SMALL


def gen_mounted_antlers():
    """Trophy antlers on wall plaque."""
    mesh = bpy.data.meshes.new('antlers_mesh')
    bm = bmesh.new()

    # Plaque
    create_cylinder_section(bm, 0.2, 0.2, 0.04, 8, 0)
    # Antler tines (simplified as boxes)
    create_box(bm, 0.04, 0.5, 0.04, x=-0.15, z=0.04)
    create_box(bm, 0.04, 0.5, 0.04, x=0.15, z=0.04)
    create_box(bm, 0.04, 0.3, 0.04, x=-0.25, z=0.3)
    create_box(bm, 0.04, 0.3, 0.04, x=0.25, z=0.3)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('mounted_antlers', mesh)
    bpy.context.collection.objects.link(obj)
    mat = create_ironwood('AntlerWood')
    obj.data.materials.append(mat)
    return obj, TEX_PROP_SMALL


def gen_iron_candle_tree():
    """Floor-standing candelabra."""
    mesh = bpy.data.meshes.new('candle_tree_mesh')
    bm = bmesh.new()

    # Base plate
    create_cylinder_section(bm, 0.2, 0.18, 0.05, 8, 0)
    # Shaft
    create_cylinder_section(bm, 0.03, 0.03, 1.5, 8, 0.05)
    # Arms (3 branches)
    for i in range(3):
        angle = 2 * math.pi * i / 3
        x = 0.15 * math.cos(angle)
        y = 0.15 * math.sin(angle)
        create_box(bm, 0.03, 0.25, 0.03, x=x, y=y, z=1.3)
        # Candle cup
        create_cylinder_section(bm, 0.04, 0.04, 0.05, 6, 1.55)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('iron_candle_tree', mesh)
    bpy.context.collection.objects.link(obj)
    mat = create_dark_iron('CandleTreeIron')
    obj.data.materials.append(mat)
    return obj, TEX_PROP_SMALL


def gen_heraldic_crest():
    """Carved stone crest above hearth."""
    mesh = bpy.data.meshes.new('crest_mesh')
    bm = bmesh.new()

    # Shield shape (wider at top)
    create_box(bm, 0.8, 0.8, 0.1, z=0)
    create_box(bm, 0.5, 0.4, 0.12, z=0.1)  # raised center

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('heraldic_crest', mesh)
    bpy.context.collection.objects.link(obj)
    mat = create_northern_stone('CrestStone', scale=8.0)
    obj.data.materials.append(mat)
    return obj, TEX_PROP_SMALL


def gen_iron_torch_holder():
    """Wall-mounted iron torch bracket."""
    mesh = bpy.data.meshes.new('torch_holder_mesh')
    bm = bmesh.new()

    # Back plate
    create_box(bm, 0.08, 0.2, 0.02, z=0)
    # Arm
    create_box(bm, 0.04, 0.04, 0.25, z=0.1, y=0.125)
    # Cup
    create_cylinder_section(bm, 0.06, 0.07, 0.1, 6, 0.1)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('iron_torch_holder', mesh)
    bpy.context.collection.objects.link(obj)
    mat = create_dark_iron('TorchIron')
    obj.data.materials.append(mat)
    return obj, TEX_PROP_SMALL


def gen_iron_chandelier():
    """Ring chandelier with chain and candle cups."""
    mesh = bpy.data.meshes.new('chandelier_mesh')
    bm = bmesh.new()

    # Main ring
    ring_r = 0.6
    ring_segments = 16
    for i in range(ring_segments):
        angle = 2 * math.pi * i / ring_segments
        x = ring_r * math.cos(angle)
        y = ring_r * math.sin(angle)
        create_box(bm, 0.04, 0.08, 0.04, x=x, y=y, z=0)

    # Candle cups (6 evenly spaced)
    for i in range(6):
        angle = 2 * math.pi * i / 6
        x = ring_r * math.cos(angle)
        y = ring_r * math.sin(angle)
        create_cylinder_section(bm, 0.04, 0.04, 0.06, 6, 0.08)

    # Chain to ceiling (3 chains)
    for i in range(3):
        angle = 2 * math.pi * i / 3
        x = (ring_r * 0.5) * math.cos(angle)
        y = (ring_r * 0.5) * math.sin(angle)
        create_box(bm, 0.02, 0.5, 0.02, x=x, y=y, z=0.08)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('iron_chandelier', mesh)
    bpy.context.collection.objects.link(obj)
    mat = create_dark_iron('ChandelierIron')
    obj.data.materials.append(mat)
    return obj, TEX_PROP_LARGE


def gen_wall_sconce():
    """Wall-mounted sconce with iron bracket."""
    mesh = bpy.data.meshes.new('sconce_mesh')
    bm = bmesh.new()

    create_box(bm, 0.06, 0.15, 0.02, z=0)
    create_box(bm, 0.03, 0.03, 0.12, z=0.08, y=0.06)
    create_cylinder_section(bm, 0.05, 0.06, 0.08, 6, 0.08)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('wall_sconce', mesh)
    bpy.context.collection.objects.link(obj)
    mat = create_dark_iron('SconceIron')
    obj.data.materials.append(mat)
    return obj, TEX_PROP_SMALL


def gen_candelabra():
    """Table candelabra."""
    mesh = bpy.data.meshes.new('candelabra_mesh')
    bm = bmesh.new()

    create_cylinder_section(bm, 0.06, 0.05, 0.02, 8, 0)
    create_cylinder_section(bm, 0.02, 0.02, 0.3, 6, 0.02)
    for i in range(3):
        angle = 2 * math.pi * i / 3
        x = 0.06 * math.cos(angle)
        y = 0.06 * math.sin(angle)
        create_cylinder_section(bm, 0.02, 0.02, 0.15, 6, 0.25)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('candelabra', mesh)
    bpy.context.collection.objects.link(obj)
    mat = create_dark_iron('CandelabraIron')
    obj.data.materials.append(mat)
    return obj, TEX_PROP_SMALL


def gen_iron_brazier():
    """Standing fire brazier."""
    mesh = bpy.data.meshes.new('brazier_mesh')
    bm = bmesh.new()

    # Base
    create_cylinder_section(bm, 0.2, 0.15, 0.05, 8, 0)
    # Shaft
    create_cylinder_section(bm, 0.04, 0.04, 0.6, 8, 0.05)
    # Bowl
    create_cylinder_section(bm, 0.15, 0.25, 0.2, 8, 0.65)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('iron_brazier', mesh)
    bpy.context.collection.objects.link(obj)
    mat = create_dark_iron('BrazierIron')
    obj.data.materials.append(mat)
    return obj, TEX_PROP_SMALL


def gen_goblet():
    """Drinking goblet."""
    mesh = bpy.data.meshes.new('goblet_mesh')
    bm = bmesh.new()

    create_cylinder_section(bm, 0.04, 0.03, 0.01, 8, 0)
    create_cylinder_section(bm, 0.015, 0.015, 0.06, 6, 0.01)
    create_cylinder_section(bm, 0.03, 0.035, 0.05, 8, 0.07)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('goblet', mesh)
    bpy.context.collection.objects.link(obj)
    mat = create_dark_iron('GobletMetal')
    obj.data.materials.append(mat)
    return obj, TEX_PROP_SMALL


def gen_plate():
    """Ceramic plate."""
    mesh = bpy.data.meshes.new('plate_mesh')
    bm = bmesh.new()

    create_cylinder_section(bm, 0.15, 0.15, 0.02, 12, 0)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('plate', mesh)
    bpy.context.collection.objects.link(obj)

    mat = bpy.data.materials.new('Ceramic')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    principled = nodes.get('Principled BSDF')
    principled.inputs['Base Color'].default_value = (0.55, 0.48, 0.40, 1.0)
    principled.inputs['Roughness'].default_value = 0.4
    obj.data.materials.append(mat)
    return obj, TEX_PROP_SMALL


def gen_food_platter():
    """Serving platter with food."""
    mesh = bpy.data.meshes.new('platter_mesh')
    bm = bmesh.new()

    # Platter
    create_cylinder_section(bm, 0.25, 0.25, 0.02, 12, 0)
    # Food mounds
    create_cylinder_section(bm, 0.08, 0.04, 0.06, 6, 0.02)
    create_cylinder_section(bm, 0.06, 0.03, 0.05, 6, 0.02)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('food_platter', mesh)
    bpy.context.collection.objects.link(obj)

    mat = bpy.data.materials.new('PlatterCeramic')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    principled = nodes.get('Principled BSDF')
    principled.inputs['Base Color'].default_value = (0.50, 0.42, 0.33, 1.0)
    principled.inputs['Roughness'].default_value = 0.45
    obj.data.materials.append(mat)
    return obj, TEX_PROP_SMALL


def gen_wine_jug():
    """Ceramic wine jug."""
    mesh = bpy.data.meshes.new('jug_mesh')
    bm = bmesh.new()

    create_cylinder_section(bm, 0.06, 0.08, 0.12, 8, 0)
    create_cylinder_section(bm, 0.08, 0.05, 0.08, 8, 0.12)
    # Spout
    create_box(bm, 0.03, 0.04, 0.03, x=0.06, z=0.18)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('wine_jug', mesh)
    bpy.context.collection.objects.link(obj)

    mat = bpy.data.materials.new('JugCeramic')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    principled = nodes.get('Principled BSDF')
    principled.inputs['Base Color'].default_value = (0.45, 0.35, 0.25, 1.0)
    principled.inputs['Roughness'].default_value = 0.5
    obj.data.materials.append(mat)
    return obj, TEX_PROP_SMALL


def gen_candle_stub():
    """Melted candle for tables."""
    mesh = bpy.data.meshes.new('candle_mesh')
    bm = bmesh.new()

    create_cylinder_section(bm, 0.02, 0.015, 0.06, 6, 0)
    # Wax drip base
    create_cylinder_section(bm, 0.03, 0.025, 0.01, 8, 0)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('candle_stub', mesh)
    bpy.context.collection.objects.link(obj)

    mat = bpy.data.materials.new('Wax')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    principled = nodes.get('Principled BSDF')
    principled.inputs['Base Color'].default_value = (0.8, 0.75, 0.6, 1.0)
    principled.inputs['Roughness'].default_value = 0.7
    principled.inputs['Subsurface Weight'].default_value = 0.3
    obj.data.materials.append(mat)
    return obj, TEX_PROP_SMALL


def gen_floor_crack():
    """Stone floor crack detail (decal quad)."""
    mesh = bpy.data.meshes.new('crack_mesh')
    bm = bmesh.new()
    create_box(bm, 1.0, 0.005, 1.0, z=0)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('floor_crack', mesh)
    bpy.context.collection.objects.link(obj)
    mat = create_northern_stone('CrackStone', scale=8.0)
    obj.data.materials.append(mat)
    return obj, TEX_PROP_SMALL, True  # skip_ao=True


def gen_wall_moss():
    """Moss growth on wall surface."""
    mesh = bpy.data.meshes.new('moss_mesh')
    bm = bmesh.new()
    create_box(bm, 0.8, 0.6, 0.005, z=0)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('wall_moss', mesh)
    bpy.context.collection.objects.link(obj)

    mat = bpy.data.materials.new('Moss')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    principled = nodes.get('Principled BSDF')
    principled.inputs['Base Color'].default_value = (0.15, 0.25, 0.1, 1.0)
    principled.inputs['Roughness'].default_value = 0.95
    obj.data.materials.append(mat)
    return obj, TEX_PROP_SMALL, True


def gen_hearth_scorch():
    """Scorch marks near fireplace."""
    mesh = bpy.data.meshes.new('scorch_mesh')
    bm = bmesh.new()
    create_box(bm, 1.2, 0.005, 0.8, z=0)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('hearth_scorch', mesh)
    bpy.context.collection.objects.link(obj)

    mat = bpy.data.materials.new('Scorch')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    principled = nodes.get('Principled BSDF')
    principled.inputs['Base Color'].default_value = (0.08, 0.06, 0.05, 1.0)
    principled.inputs['Roughness'].default_value = 0.9
    obj.data.materials.append(mat)
    return obj, TEX_PROP_SMALL, True


def gen_table_stain():
    """Drink stain on table."""
    mesh = bpy.data.meshes.new('stain_mesh')
    bm = bmesh.new()
    create_cylinder_section(bm, 0.1, 0.1, 0.002, 8, 0)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('table_stain', mesh)
    bpy.context.collection.objects.link(obj)

    mat = bpy.data.materials.new('Stain')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    principled = nodes.get('Principled BSDF')
    principled.inputs['Base Color'].default_value = (0.2, 0.12, 0.08, 1.0)
    principled.inputs['Roughness'].default_value = 0.4
    obj.data.materials.append(mat)
    return obj, TEX_PROP_SMALL, True


def gen_fur_rug():
    """Animal pelt rug."""
    mesh = bpy.data.meshes.new('rug_mesh')
    bm = bmesh.new()
    create_box(bm, 2.0, 0.03, 1.5, z=0)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('fur_rug', mesh)
    bpy.context.collection.objects.link(obj)
    mat = create_leather('RugLeather', base_color=(0.35, 0.28, 0.20))
    obj.data.materials.append(mat)
    return obj, TEX_PROP_LARGE


def gen_rushes():
    """Floor rushes scatter."""
    mesh = bpy.data.meshes.new('rushes_mesh')
    bm = bmesh.new()
    create_box(bm, 1.5, 0.02, 1.0, z=0)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('rushes', mesh)
    bpy.context.collection.objects.link(obj)

    mat = bpy.data.materials.new('Rushes')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    principled = nodes.get('Principled BSDF')
    principled.inputs['Base Color'].default_value = (0.35, 0.32, 0.18, 1.0)
    principled.inputs['Roughness'].default_value = 0.95
    obj.data.materials.append(mat)
    return obj, TEX_PROP_LARGE


def gen_hound_sleeping():
    """Sleeping hound (simplified shape)."""
    mesh = bpy.data.meshes.new('hound_mesh')
    bm = bmesh.new()

    # Body
    create_box(bm, 0.8, 0.25, 0.35, z=0)
    # Head
    create_box(bm, 0.2, 0.2, 0.18, x=0.45, z=0.05)

    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('hound_sleeping', mesh)
    bpy.context.collection.objects.link(obj)
    mat = create_leather('HoundFur', base_color=(0.25, 0.18, 0.12))
    obj.data.materials.append(mat)
    return obj, TEX_PROP_SMALL


def gen_worn_path():
    """Floor wear pattern at high-traffic areas."""
    mesh = bpy.data.meshes.new('path_mesh')
    bm = bmesh.new()
    create_box(bm, 2.0, 0.003, 1.5, z=0)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('worn_path', mesh)
    bpy.context.collection.objects.link(obj)
    mat = create_northern_stone('WornStone', scale=6.0)
    obj.data.materials.append(mat)
    return obj, TEX_PROP_LARGE, True


def gen_cobweb():
    """Corner cobwebs (flat quad)."""
    mesh = bpy.data.meshes.new('cobweb_mesh')
    bm = bmesh.new()
    create_box(bm, 0.5, 0.5, 0.001, z=0)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new('cobweb', mesh)
    bpy.context.collection.objects.link(obj)

    mat = bpy.data.materials.new('Cobweb')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    principled = nodes.get('Principled BSDF')
    principled.inputs['Base Color'].default_value = (0.8, 0.8, 0.8, 1.0)
    principled.inputs['Roughness'].default_value = 0.9
    principled.inputs['Alpha'].default_value = 0.3
    if hasattr(mat, 'blend_method'):
        mat.blend_method = 'CLIP'
    obj.data.materials.append(mat)
    return obj, TEX_PROP_SMALL


# ═══════════════════════════════════════════════════════════════════════
# PROP REGISTRY
# ═══════════════════════════════════════════════════════════════════════

PROP_REGISTRY = {
    'stone-hearth': gen_stone_hearth,
    'raised-dais': gen_raised_dais,
    'stone-arch': gen_stone_arch,
    'stone-pilaster': gen_stone_pilaster,
    'corbel-bracket': gen_corbel_bracket,
    'stone-window-frame': gen_stone_window_frame,
    'door-frame': gen_door_frame,
    'ironwood-throne': gen_ironwood_throne,
    'long-table': gen_long_table,
    'bench': gen_bench,
    'high-seat': gen_high_seat,
    'chair': gen_chair,
    'sideboard': gen_sideboard,
    'wooden-chest-large': gen_wooden_chest_large,
    'stool': gen_stool,
    'roof-beam': gen_roof_beam,
    'roof-joist': gen_roof_joist,
    'rafter-set': gen_rafter_set,
    'banner': gen_banner,
    'tapestry': gen_tapestry,
    'weapon-rack': gen_weapon_rack,
    'dire-wolf-shield': gen_dire_wolf_shield,
    'mounted-antlers': gen_mounted_antlers,
    'iron-candle-tree': gen_iron_candle_tree,
    'heraldic-crest': gen_heraldic_crest,
    'iron-torch-holder': gen_iron_torch_holder,
    'iron-chandelier': gen_iron_chandelier,
    'wall-sconce': gen_wall_sconce,
    'candelabra': gen_candelabra,
    'iron-brazier': gen_iron_brazier,
    'goblet': gen_goblet,
    'plate': gen_plate,
    'food-platter': gen_food_platter,
    'wine-jug': gen_wine_jug,
    'candle-stub': gen_candle_stub,
    'floor-crack': gen_floor_crack,
    'wall-moss': gen_wall_moss,
    'hearth-scorch': gen_hearth_scorch,
    'table-stain': gen_table_stain,
    'fur-rug': gen_fur_rug,
    'rushes': gen_rushes,
    'hound-sleeping': gen_hound_sleeping,
    'worn-path': gen_worn_path,
    'cobweb': gen_cobweb,
}


def generate_single_prop(prop_name):
    """Generate a single prop by name."""
    if prop_name not in PROP_REGISTRY:
        print(f"ERROR: Unknown prop '{prop_name}'")
        print(f"Available props: {', '.join(sorted(PROP_REGISTRY.keys()))}")
        sys.exit(1)

    start = time.time()
    print(f"[{prop_name}] Generating...")

    clean_scene()

    # Call generator
    result = PROP_REGISTRY[prop_name]()
    skip_ao = False
    if len(result) == 3:
        obj, tex_size, skip_ao = result
    else:
        obj, tex_size = result

    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)

    # Process: bevel → smooth → UV → bake → replace material → export
    add_bevel(obj, width=0.015, segments=1)
    smooth_shade(obj)
    remove_doubles(obj)
    smart_uv_unwrap(obj)

    print(f"[{prop_name}] Baking PBR textures ({tex_size}px)...")
    images = bake_pbr(obj, tex_size, skip_ao=skip_ao)
    replace_material_with_baked(obj, images)

    prepare_for_export(obj)

    output_path = os.path.join(MODEL_OUTPUT_DIR, f'{prop_name}.glb')
    meta = export_glb(obj, output_path)

    elapsed = time.time() - start
    print(f"[{prop_name}] Done: {meta['tri_count']} tris, {meta['file_size_kb']:.1f}KB, {elapsed:.1f}s")
    return meta


# ═══════════════════════════════════════════════════════════════════════
# CLI ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    # Get prop name from command line args (after --)
    argv = sys.argv
    if '--' in argv:
        args = argv[argv.index('--') + 1:]
    else:
        args = []

    if not args:
        print("Usage: blender --background --factory-startup --python generate_prop.py -- <prop-name>")
        print(f"Available props: {', '.join(sorted(PROP_REGISTRY.keys()))}")
        sys.exit(1)

    prop_name = args[0]

    if prop_name == 'all':
        # Generate all props
        total_start = time.time()
        results = {}
        for name in sorted(PROP_REGISTRY.keys()):
            try:
                results[name] = generate_single_prop(name)
            except Exception as e:
                print(f"[{name}] FAILED: {e}")
                results[name] = {'error': str(e)}

        total_time = time.time() - total_start
        print(f"\n{'='*60}")
        print(f"BATCH COMPLETE: {len(results)} props in {total_time:.1f}s")
        total_tris = sum(r.get('tri_count', 0) for r in results.values())
        total_kb = sum(r.get('file_size_kb', 0) for r in results.values())
        errors = [n for n, r in results.items() if 'error' in r]
        print(f"Total tris: {total_tris}, Total size: {total_kb:.1f}KB")
        if errors:
            print(f"ERRORS: {', '.join(errors)}")
    else:
        generate_single_prop(prop_name)
