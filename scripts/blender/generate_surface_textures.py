"""
Generate tileable PBR surface textures for room surfaces.

Bakes procedural materials onto a flat plane to produce tileable
diffuse, normal, roughness, and AO maps as JPEG files.

Usage:
  blender --background --factory-startup --python scripts/blender/generate_surface_textures.py -- <set-name>
  blender --background --factory-startup --python scripts/blender/generate_surface_textures.py -- all
"""
import bpy
import sys
import os
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lib.mesh_ops import clean_scene
from lib.materials import create_northern_stone, create_ironwood
from lib.bake import setup_cycles_bake
from lib.conventions import (
    TEXTURE_OUTPUT_DIR, TEX_SURFACE,
    BAKE_SAMPLES_FAST, BAKE_SAMPLES_AO,
)


def create_bake_plane(size=2.0):
    """Create a subdivided plane for texture baking."""
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, 0))
    obj = bpy.context.active_object
    obj.name = 'bake_plane'

    # Subdivide for better bake quality
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.subdivide(number_cuts=4)
    bpy.ops.object.mode_set(mode='OBJECT')

    # UV unwrap — the default plane UV is already 0-1, perfect for tiling
    return obj


def bake_surface_set(obj, tex_size, output_dir, name):
    """Bake PBR maps and save as individual JPEG files."""
    setup_cycles_bake()
    scene = bpy.context.scene
    mat = obj.data.materials[0]
    nodes = mat.node_tree.nodes

    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)

    os.makedirs(output_dir, exist_ok=True)

    passes = [
        ('diffuse', 'DIFFUSE', 'sRGB', BAKE_SAMPLES_FAST, {'COLOR'}),
        ('normal', 'NORMAL', 'Non-Color', BAKE_SAMPLES_FAST, None),
        ('roughness', 'ROUGHNESS', 'Non-Color', BAKE_SAMPLES_FAST, None),
        ('ao', 'AO', 'Non-Color', BAKE_SAMPLES_AO, None),
    ]

    for filename, pass_type, colorspace, samples, pass_filter in passes:
        img = bpy.data.images.new(f"bake_{filename}", tex_size, tex_size)
        img.colorspace_settings.name = colorspace

        # Create temp image texture node
        img_node = nodes.new('ShaderNodeTexImage')
        img_node.image = img
        img_node.location = (800, 0)
        nodes.active = img_node

        scene.cycles.samples = samples

        if pass_filter:
            bpy.ops.object.bake(type=pass_type, pass_filter=pass_filter)
        else:
            bpy.ops.object.bake(type=pass_type)

        nodes.remove(img_node)

        # Save as JPEG
        filepath = os.path.join(output_dir, f'{filename}.jpg')
        img.filepath_raw = filepath
        img.file_format = 'JPEG'
        scene.render.image_settings.quality = 90
        img.save_render(filepath)
        bpy.data.images.remove(img)

        print(f"  [{name}] Saved {filename}.jpg ({tex_size}px)")


# ═══════════════════════════════════════════════════════════════════════
# SURFACE TEXTURE DEFINITIONS
# ═══════════════════════════════════════════════════════════════════════

def gen_floor_stone():
    """Northern stone floor — grey flagstones with worn surface."""
    obj = create_bake_plane()
    mat = create_northern_stone('FloorStone', scale=3.0, seed=42)
    obj.data.materials.append(mat)
    return obj, os.path.join(TEXTURE_OUTPUT_DIR, 'stone', 'northern-floor')


def gen_wall_stone():
    """Castle wall stone — slightly different scale and color from floor."""
    obj = create_bake_plane()
    mat = create_northern_stone('WallStone', scale=4.0, seed=7)
    obj.data.materials.append(mat)
    return obj, os.path.join(TEXTURE_OUTPUT_DIR, 'stone', 'northern-wall')


def gen_ceiling_wood():
    """Dark ironwood ceiling planks."""
    obj = create_bake_plane()
    mat = create_ironwood('CeilingWood', scale=1.5, grain_density=4.0, seed=13)
    obj.data.materials.append(mat)
    return obj, os.path.join(TEXTURE_OUTPUT_DIR, 'wood', 'ironwood-ceiling')


SURFACE_REGISTRY = {
    'floor-stone': gen_floor_stone,
    'wall-stone': gen_wall_stone,
    'ceiling-wood': gen_ceiling_wood,
}


def generate_surface(name):
    """Generate a single surface texture set."""
    if name not in SURFACE_REGISTRY:
        print(f"ERROR: Unknown surface '{name}'")
        print(f"Available: {', '.join(sorted(SURFACE_REGISTRY.keys()))}")
        sys.exit(1)

    start = time.time()
    print(f"[{name}] Generating surface textures...")
    clean_scene()

    obj, output_dir = SURFACE_REGISTRY[name]()

    bake_surface_set(obj, TEX_SURFACE, output_dir, name)

    elapsed = time.time() - start
    print(f"[{name}] Done in {elapsed:.1f}s → {output_dir}")
    return output_dir


# ═══════════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    argv = sys.argv
    if '--' in argv:
        args = argv[argv.index('--') + 1:]
    else:
        args = []

    if not args:
        print("Usage: blender --background --factory-startup --python generate_surface_textures.py -- <set-name>")
        print(f"Available: {', '.join(sorted(SURFACE_REGISTRY.keys()))}")
        sys.exit(1)

    name = args[0]

    if name == 'all':
        total_start = time.time()
        for sname in sorted(SURFACE_REGISTRY.keys()):
            try:
                generate_surface(sname)
            except Exception as e:
                print(f"[{sname}] FAILED: {e}")
        total_time = time.time() - total_start
        print(f"\nAll surface textures generated in {total_time:.1f}s")
    else:
        generate_surface(name)
