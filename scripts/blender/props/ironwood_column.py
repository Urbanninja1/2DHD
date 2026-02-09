"""
Generate an ironwood column with base plinth and capital.

Octagonal shaft with dark ironwood grain, beveled transitions,
baked PBR textures (diffuse, normal, roughness, AO).

Matches existing dimensions: ~0.35-0.4 radius shaft, ~9.5 total height.
Origin at base center (y=0 in Blender Z-up, exported as Y-up).

Usage:
  blender --background --factory-startup --python scripts/blender/props/ironwood_column.py
"""
import bpy
import bmesh
import os
import sys
import time
import math

start_time = time.time()

# --- Configuration ---
SEED = 42
TEX_SIZE = 512
COLUMN_HEIGHT = 9.0
SHAFT_RADIUS_BOTTOM = 0.4
SHAFT_RADIUS_TOP = 0.35
BASE_RADIUS_BOTTOM = 0.55
BASE_RADIUS_TOP = 0.5
BASE_HEIGHT = 0.6
CAPITAL_RADIUS_BOTTOM = 0.35
CAPITAL_RADIUS_TOP = 0.5
CAPITAL_HEIGHT = 0.5
SEGMENTS = 8  # Octagonal
MAX_GLB_KB = 100

# Output path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..', '..'))
OUTPUT_PATH = os.path.join(PROJECT_ROOT, 'public', 'assets', 'models', 'props', 'ironrath', 'ironwood-column.glb')
os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

print(f"[ironwood-column] Output: {OUTPUT_PATH}")

# --- Clean scene ---
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
for block in list(bpy.data.materials): bpy.data.materials.remove(block)
for block in list(bpy.data.meshes): bpy.data.meshes.remove(block)
for block in list(bpy.data.images): bpy.data.images.remove(block)

# --- Build geometry with BMesh ---
mesh = bpy.data.meshes.new('column_mesh')
bm = bmesh.new()

def add_cylinder(bm_obj, radius_bottom, radius_top, height, segments, z_offset):
    """Add a cylinder section to BMesh at a given z offset."""
    verts_bottom = []
    verts_top = []
    for i in range(segments):
        angle = 2 * math.pi * i / segments
        # Bottom ring
        x_b = radius_bottom * math.cos(angle)
        y_b = radius_bottom * math.sin(angle)
        verts_bottom.append(bm_obj.verts.new((x_b, y_b, z_offset)))
        # Top ring
        x_t = radius_top * math.cos(angle)
        y_t = radius_top * math.sin(angle)
        verts_top.append(bm_obj.verts.new((x_t, y_t, z_offset + height)))

    # Side faces
    for i in range(segments):
        j = (i + 1) % segments
        bm_obj.faces.new([verts_bottom[i], verts_bottom[j], verts_top[j], verts_top[i]])

    # Cap faces
    bm_obj.faces.new(verts_bottom)
    bm_obj.faces.new(list(reversed(verts_top)))

    return verts_bottom, verts_top

# Base plinth (slightly wider)
add_cylinder(bm, BASE_RADIUS_BOTTOM, BASE_RADIUS_TOP, BASE_HEIGHT, SEGMENTS, 0)

# Shaft (main column body)
add_cylinder(bm, SHAFT_RADIUS_BOTTOM, SHAFT_RADIUS_TOP, COLUMN_HEIGHT, SEGMENTS, BASE_HEIGHT)

# Capital (flares out at top)
add_cylinder(bm, CAPITAL_RADIUS_BOTTOM, CAPITAL_RADIUS_TOP, CAPITAL_HEIGHT, SEGMENTS, BASE_HEIGHT + COLUMN_HEIGHT)

bm.to_mesh(mesh)
bm.free()

# Create object
obj = bpy.data.objects.new('ironwood_column', mesh)
bpy.context.collection.objects.link(obj)
bpy.context.view_layer.objects.active = obj
obj.select_set(True)

# --- Add bevel modifier for smooth edges ---
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
# Merge vertices that are very close (where sections meet)
bpy.ops.mesh.remove_doubles(threshold=0.001)
bpy.ops.object.mode_set(mode='OBJECT')

bevel = obj.modifiers.new('Bevel', 'BEVEL')
bevel.width = 0.02
bevel.segments = 2
bevel.limit_method = 'ANGLE'
bevel.angle_limit = 0.7854  # 45 degrees
bpy.ops.object.modifier_apply(modifier='Bevel')

# --- Smooth shading ---
bpy.ops.object.shade_smooth()

# --- UV unwrap ---
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=1.15192, island_margin=0.02)
bpy.ops.object.mode_set(mode='OBJECT')

# --- Create ironwood material ---
mat = bpy.data.materials.new('IronwoodMaterial')
mat.use_nodes = True
nodes = mat.node_tree.nodes
links = mat.node_tree.links
nodes.clear()

# Output
output = nodes.new('ShaderNodeOutputMaterial')
output.location = (600, 0)

# Principled BSDF
principled = nodes.new('ShaderNodeBsdfPrincipled')
principled.location = (300, 0)
principled.inputs['Roughness'].default_value = 0.65
principled.inputs['Specular IOR Level'].default_value = 0.35
principled.inputs['Metallic'].default_value = 0.0
links.new(principled.outputs['BSDF'], output.inputs['Surface'])

# Texture coordinate + mapping
tex_coord = nodes.new('ShaderNodeTexCoord')
tex_coord.location = (-1000, 0)
mapping = nodes.new('ShaderNodeMapping')
mapping.location = (-800, 0)
mapping.inputs['Scale'].default_value = (2.0, 2.0, 8.0)  # Stretch along Z for vertical grain
links.new(tex_coord.outputs['Object'], mapping.inputs['Vector'])

# Wave Texture for wood grain direction
wave = nodes.new('ShaderNodeTexWave')
wave.location = (-600, 200)
wave.wave_type = 'BANDS'
wave.bands_direction = 'Z'  # Vertical grain
wave.inputs['Scale'].default_value = 3.0
wave.inputs['Distortion'].default_value = 4.0
wave.inputs['Detail'].default_value = 4.0
wave.inputs['Detail Scale'].default_value = 1.0
links.new(mapping.outputs['Vector'], wave.inputs['Vector'])

# Noise for grain variation
noise = nodes.new('ShaderNodeTexNoise')
noise.location = (-600, -100)
noise.noise_type = 'FBM'
noise.inputs['Scale'].default_value = 12.0
noise.inputs['Detail'].default_value = 6.0
noise.inputs['Roughness'].default_value = 0.5
links.new(mapping.outputs['Vector'], noise.inputs['Vector'])

# Voronoi for knot pattern
voronoi = nodes.new('ShaderNodeTexVoronoi')
voronoi.location = (-600, -350)
voronoi.inputs['Scale'].default_value = 2.0
voronoi.feature = 'F1'
links.new(mapping.outputs['Vector'], voronoi.inputs['Vector'])

# Mix wave + noise for grain pattern
mix_grain = nodes.new('ShaderNodeMix')
mix_grain.location = (-350, 100)
mix_grain.data_type = 'FLOAT'
mix_grain.inputs['Factor'].default_value = 0.3  # Mostly wave, some noise
links.new(wave.outputs['Fac'], mix_grain.inputs[2])  # A
links.new(noise.outputs['Fac'], mix_grain.inputs[3])  # B

# Add knots subtly
mix_knots = nodes.new('ShaderNodeMix')
mix_knots.location = (-200, 50)
mix_knots.data_type = 'FLOAT'
mix_knots.inputs['Factor'].default_value = 0.15  # Subtle knots
links.new(mix_grain.outputs[0], mix_knots.inputs[2])  # A (grain)
links.new(voronoi.outputs['Distance'], mix_knots.inputs[3])  # B (knots)

# Color Ramp for ironwood palette (dark rich brown)
color_ramp = nodes.new('ShaderNodeValToRGB')
color_ramp.location = (0, 100)
color_ramp.color_ramp.elements[0].position = 0.3
color_ramp.color_ramp.elements[0].color = (0.176, 0.133, 0.094, 1.0)  # #2d2218 dark ironwood
color_ramp.color_ramp.elements[1].position = 0.7
color_ramp.color_ramp.elements[1].color = (0.290, 0.208, 0.145, 1.0)  # #4a3525 lighter grain
links.new(mix_knots.outputs[0], color_ramp.inputs['Fac'])
links.new(color_ramp.outputs['Color'], principled.inputs['Base Color'])

# Roughness variation from grain
rough_ramp = nodes.new('ShaderNodeValToRGB')
rough_ramp.location = (0, -150)
rough_ramp.color_ramp.elements[0].position = 0.3
rough_ramp.color_ramp.elements[0].color = (0.55, 0.55, 0.55, 1.0)  # Smoother grain lines
rough_ramp.color_ramp.elements[1].position = 0.7
rough_ramp.color_ramp.elements[1].color = (0.75, 0.75, 0.75, 1.0)  # Rougher between
links.new(mix_grain.outputs[0], rough_ramp.inputs['Fac'])
links.new(rough_ramp.outputs['Color'], principled.inputs['Roughness'])

# Bump for surface detail
bump = nodes.new('ShaderNodeBump')
bump.location = (100, -300)
bump.inputs['Strength'].default_value = 0.2
bump.inputs['Distance'].default_value = 0.01
links.new(mix_knots.outputs[0], bump.inputs['Height'])
links.new(bump.outputs['Normal'], principled.inputs['Normal'])

# Assign material
obj.data.materials.append(mat)

# --- Set up Cycles for baking ---
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'

bpy.context.view_layer.objects.active = obj
obj.select_set(True)

# --- Bake PBR passes ---
print("[ironwood-column] Baking PBR textures...")

bake_images = {}

def bake_pass(pass_type, samples=64):
    """Bake a single PBR pass."""
    img = bpy.data.images.new(f"bake_{pass_type.lower()}", TEX_SIZE, TEX_SIZE)
    if pass_type == 'DIFFUSE':
        img.colorspace_settings.name = 'sRGB'
    else:
        img.colorspace_settings.name = 'Non-Color'

    # Create temp image texture node and make it active
    img_node = nodes.new('ShaderNodeTexImage')
    img_node.image = img
    img_node.location = (800, 0)
    nodes.active = img_node

    scene.cycles.samples = samples

    if pass_type == 'DIFFUSE':
        bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'})
    elif pass_type == 'NORMAL':
        bpy.ops.object.bake(type='NORMAL')
    elif pass_type == 'ROUGHNESS':
        bpy.ops.object.bake(type='ROUGHNESS')
    elif pass_type == 'AO':
        bpy.ops.object.bake(type='AO')

    nodes.remove(img_node)
    bake_images[pass_type] = img
    print(f"[ironwood-column] Baked {pass_type}")
    return img

bake_pass('DIFFUSE', samples=1)
bake_pass('NORMAL', samples=1)
bake_pass('ROUGHNESS', samples=1)
bake_pass('AO', samples=64)

# --- Replace procedural material with baked images for GLB export ---
nodes.clear()

output = nodes.new('ShaderNodeOutputMaterial')
output.location = (400, 0)
principled = nodes.new('ShaderNodeBsdfPrincipled')
principled.location = (100, 0)
principled.inputs['Roughness'].default_value = 0.65
principled.inputs['Metallic'].default_value = 0.0
links.new(principled.outputs['BSDF'], output.inputs['Surface'])

# Diffuse
diff_node = nodes.new('ShaderNodeTexImage')
diff_node.location = (-300, 200)
diff_node.image = bake_images['DIFFUSE']

# AO multiply into diffuse
ao_node = nodes.new('ShaderNodeTexImage')
ao_node.location = (-500, 100)
ao_node.image = bake_images['AO']
ao_node.image.colorspace_settings.name = 'Non-Color'

ao_mix = nodes.new('ShaderNodeMix')
ao_mix.location = (-100, 200)
ao_mix.data_type = 'RGBA'
ao_mix.blend_type = 'MULTIPLY'
ao_mix.inputs['Factor'].default_value = 1.0
links.new(diff_node.outputs['Color'], ao_mix.inputs[6])
links.new(ao_node.outputs['Color'], ao_mix.inputs[7])
links.new(ao_mix.outputs[2], principled.inputs['Base Color'])

# Normal map
norm_node = nodes.new('ShaderNodeTexImage')
norm_node.location = (-500, -200)
norm_node.image = bake_images['NORMAL']
norm_node.image.colorspace_settings.name = 'Non-Color'

normal_map = nodes.new('ShaderNodeNormalMap')
normal_map.location = (-200, -200)
normal_map.inputs['Strength'].default_value = 1.0
links.new(norm_node.outputs['Color'], normal_map.inputs['Color'])
links.new(normal_map.outputs['Normal'], principled.inputs['Normal'])

# Roughness
rough_node = nodes.new('ShaderNodeTexImage')
rough_node.location = (-300, -50)
rough_node.image = bake_images['ROUGHNESS']
rough_node.image.colorspace_settings.name = 'Non-Color'
links.new(rough_node.outputs['Color'], principled.inputs['Roughness'])

# --- Triangulate mesh (required for tangent export) ---
tri_mod = obj.modifiers.new('Triangulate', 'TRIANGULATE')
bpy.ops.object.modifier_apply(modifier='Triangulate')

# --- Apply transforms ---
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

# --- Ensure origin at base center ---
# The geometry was built with base at z=0, so origin should already be at base center.
# But let's explicitly verify and fix.
obj.location = (0, 0, 0)

# --- Export GLB ---
print(f"[ironwood-column] Exporting GLB...")
bpy.ops.export_scene.gltf(
    filepath=OUTPUT_PATH,
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_tangents=True,
    export_yup=True,
    export_image_format='JPEG',
    export_image_quality=85,
)

# --- Report ---
file_size_kb = os.path.getsize(OUTPUT_PATH) / 1024
tri_count = sum(len(p.vertices) - 2 for p in obj.data.polygons)
total_height = max(v.co.z for v in obj.data.vertices) - min(v.co.z for v in obj.data.vertices)
elapsed = time.time() - start_time

print(f"[ironwood-column] GLB size: {file_size_kb:.1f} KB (budget: {MAX_GLB_KB} KB)")
print(f"[ironwood-column] Triangles: {tri_count}")
print(f"[ironwood-column] Height: {total_height:.2f} units")
print(f"[ironwood-column] Time: {elapsed:.1f}s")

if file_size_kb > MAX_GLB_KB:
    print(f"[ironwood-column] WARNING: GLB exceeds {MAX_GLB_KB}KB budget!")

print("[ironwood-column] DONE")
