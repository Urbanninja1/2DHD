"""
Spike test: Generate a beveled cube with procedural stone material,
bake PBR textures (diffuse, normal, roughness, AO), and export as GLB.

Validates the full Blender → GLB → Three.js pipeline.

Usage:
  blender --background --factory-startup --python scripts/blender/spike_test.py
"""
import bpy
import os
import sys
import time

start_time = time.time()

# --- Configuration ---
TEX_SIZE = 512
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'assets', 'models', 'props', 'test')
OUTPUT_PATH = os.path.join(OUTPUT_DIR, 'spike-cube.glb')

# Resolve to absolute path
OUTPUT_DIR = os.path.abspath(OUTPUT_DIR)
OUTPUT_PATH = os.path.abspath(OUTPUT_PATH)
os.makedirs(OUTPUT_DIR, exist_ok=True)

print(f"[spike] Output: {OUTPUT_PATH}")

# --- Clean scene ---
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# Remove all materials, meshes, images from file
for block in bpy.data.materials:
    bpy.data.materials.remove(block)
for block in bpy.data.meshes:
    bpy.data.meshes.remove(block)
for block in bpy.data.images:
    bpy.data.images.remove(block)

# --- Create beveled cube ---
bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.5))
obj = bpy.context.active_object
obj.name = 'spike_cube'

# Add bevel modifier for smooth edges
bevel = obj.modifiers.new('Bevel', 'BEVEL')
bevel.width = 0.03
bevel.segments = 2
bevel.limit_method = 'ANGLE'
bevel.angle_limit = 1.0472  # 60 degrees

# Apply modifier
bpy.ops.object.modifier_apply(modifier='Bevel')

# --- UV unwrap ---
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=1.15192, island_margin=0.02)
bpy.ops.object.mode_set(mode='OBJECT')

# --- Create procedural stone material ---
mat = bpy.data.materials.new('StoneMaterial')
mat.use_nodes = True  # Deprecated in 6.0, fine for 5.0
nodes = mat.node_tree.nodes
links = mat.node_tree.links

# Clear defaults
nodes.clear()

# Output node
output = nodes.new('ShaderNodeOutputMaterial')
output.location = (400, 0)

# Principled BSDF
principled = nodes.new('ShaderNodeBsdfPrincipled')
principled.location = (100, 0)
principled.inputs['Roughness'].default_value = 0.85
principled.inputs['Specular IOR Level'].default_value = 0.3
principled.inputs['Metallic'].default_value = 0.0
links.new(principled.outputs['BSDF'], output.inputs['Surface'])

# Texture coordinate
tex_coord = nodes.new('ShaderNodeTexCoord')
tex_coord.location = (-800, 0)

# Mapping for scale control
mapping = nodes.new('ShaderNodeMapping')
mapping.location = (-600, 0)
mapping.inputs['Scale'].default_value = (4.0, 4.0, 4.0)
links.new(tex_coord.outputs['Object'], mapping.inputs['Vector'])

# Noise Texture (FBM type - replaces old Musgrave)
noise_fbm = nodes.new('ShaderNodeTexNoise')
noise_fbm.location = (-400, 100)
noise_fbm.noise_type = 'FBM'
noise_fbm.inputs['Scale'].default_value = 6.0
noise_fbm.inputs['Detail'].default_value = 8.0
noise_fbm.inputs['Roughness'].default_value = 0.6
links.new(mapping.outputs['Vector'], noise_fbm.inputs['Vector'])

# Voronoi for stone block pattern
voronoi = nodes.new('ShaderNodeTexVoronoi')
voronoi.location = (-400, -200)
voronoi.inputs['Scale'].default_value = 3.0
voronoi.feature = 'F1'
links.new(mapping.outputs['Vector'], voronoi.inputs['Vector'])

# Color Ramp for stone base color
color_ramp = nodes.new('ShaderNodeValToRGB')
color_ramp.location = (-100, 100)
# Grey stone palette
color_ramp.color_ramp.elements[0].position = 0.3
color_ramp.color_ramp.elements[0].color = (0.29, 0.27, 0.25, 1.0)  # #4a4540 dark grey
color_ramp.color_ramp.elements[1].position = 0.7
color_ramp.color_ramp.elements[1].color = (0.42, 0.40, 0.37, 1.0)  # #6b6560 light grey

# Mix noise and voronoi for combined stone pattern
mix_rgb = nodes.new('ShaderNodeMix')
mix_rgb.location = (-200, 0)
mix_rgb.data_type = 'RGBA'
mix_rgb.inputs['Factor'].default_value = 0.3
links.new(noise_fbm.outputs['Fac'], mix_rgb.inputs[6])  # A input for RGBA
links.new(voronoi.outputs['Distance'], mix_rgb.inputs[7])  # B input for RGBA

# Feed mixed pattern through color ramp
links.new(mix_rgb.outputs[2], color_ramp.inputs['Fac'])  # Result output for RGBA

# Connect to Base Color
links.new(color_ramp.outputs['Color'], principled.inputs['Base Color'])

# Bump node for surface detail
bump = nodes.new('ShaderNodeBump')
bump.location = (-100, -200)
bump.inputs['Strength'].default_value = 0.3
links.new(noise_fbm.outputs['Fac'], bump.inputs['Height'])
links.new(bump.outputs['Normal'], principled.inputs['Normal'])

# Assign material to object
obj.data.materials.append(mat)

# --- Set up Cycles for baking ---
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 64

# Make object active and selected
bpy.context.view_layer.objects.active = obj
obj.select_set(True)

# --- Bake helper function ---
def bake_pass(pass_type, filename, samples=None):
    """Bake a single PBR pass to an image."""
    img = bpy.data.images.new(f"bake_{pass_type}", TEX_SIZE, TEX_SIZE)
    img.colorspace_settings.name = 'sRGB' if pass_type == 'DIFFUSE' else 'Non-Color'

    # Create image texture node and make it active
    img_node = nodes.new('ShaderNodeTexImage')
    img_node.image = img
    img_node.location = (600, 0)
    nodes.active = img_node  # CRITICAL: bake target must be active/selected

    if samples:
        scene.cycles.samples = samples

    # Configure bake settings
    if pass_type == 'DIFFUSE':
        bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'})
    elif pass_type == 'NORMAL':
        scene.cycles.samples = 1
        bpy.ops.object.bake(type='NORMAL')
    elif pass_type == 'ROUGHNESS':
        scene.cycles.samples = 1
        bpy.ops.object.bake(type='ROUGHNESS')
    elif pass_type == 'AO':
        scene.cycles.samples = 64
        bpy.ops.object.bake(type='AO')

    # Save image
    img.filepath_raw = os.path.join(OUTPUT_DIR, filename)
    img.file_format = 'PNG'
    img.save()
    print(f"[spike] Baked {pass_type}: {filename}")

    # Remove the temp image node
    nodes.remove(img_node)

    return img

# --- Bake all PBR passes ---
print("[spike] Baking PBR textures...")
img_diffuse = bake_pass('DIFFUSE', 'spike-cube_diffuse.png')
img_normal = bake_pass('NORMAL', 'spike-cube_normal.png', samples=1)
img_roughness = bake_pass('ROUGHNESS', 'spike-cube_roughness.png', samples=1)
img_ao = bake_pass('AO', 'spike-cube_ao.png', samples=64)

# --- Replace procedural material with baked textures for export ---
# Clear all nodes and rebuild with image textures
nodes.clear()

output = nodes.new('ShaderNodeOutputMaterial')
output.location = (400, 0)

principled = nodes.new('ShaderNodeBsdfPrincipled')
principled.location = (100, 0)
principled.inputs['Roughness'].default_value = 0.85
principled.inputs['Specular IOR Level'].default_value = 0.3
principled.inputs['Metallic'].default_value = 0.0
links.new(principled.outputs['BSDF'], output.inputs['Surface'])

# Diffuse texture
diffuse_node = nodes.new('ShaderNodeTexImage')
diffuse_node.location = (-300, 200)
diffuse_node.image = img_diffuse
links.new(diffuse_node.outputs['Color'], principled.inputs['Base Color'])

# Normal map texture
normal_tex = nodes.new('ShaderNodeTexImage')
normal_tex.location = (-500, -200)
normal_tex.image = img_normal
normal_tex.image.colorspace_settings.name = 'Non-Color'

normal_map = nodes.new('ShaderNodeNormalMap')
normal_map.location = (-200, -200)
normal_map.inputs['Strength'].default_value = 1.0
links.new(normal_tex.outputs['Color'], normal_map.inputs['Color'])
links.new(normal_map.outputs['Normal'], principled.inputs['Normal'])

# Roughness texture
rough_tex = nodes.new('ShaderNodeTexImage')
rough_tex.location = (-300, -50)
rough_tex.image = img_roughness
rough_tex.image.colorspace_settings.name = 'Non-Color'
links.new(rough_tex.outputs['Color'], principled.inputs['Roughness'])

# AO - multiply into diffuse
ao_tex = nodes.new('ShaderNodeTexImage')
ao_tex.location = (-500, 100)
ao_tex.image = img_ao
ao_tex.image.colorspace_settings.name = 'Non-Color'

ao_mix = nodes.new('ShaderNodeMix')
ao_mix.location = (-100, 200)
ao_mix.data_type = 'RGBA'
ao_mix.blend_type = 'MULTIPLY'
ao_mix.inputs['Factor'].default_value = 1.0
links.new(diffuse_node.outputs['Color'], ao_mix.inputs[6])
links.new(ao_tex.outputs['Color'], ao_mix.inputs[7])
links.new(ao_mix.outputs[2], principled.inputs['Base Color'])

# --- Apply transforms before export ---
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

# --- Set origin to base center ---
# Move origin to bottom center of bounding box
bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
# Now move origin down to base
bbox = obj.bound_box
min_z = min(v[2] for v in bbox)
obj.location.z -= min_z * obj.scale.z

# --- Export GLB ---
print(f"[spike] Exporting GLB to {OUTPUT_PATH}")
bpy.ops.export_scene.gltf(
    filepath=OUTPUT_PATH,
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_tangents=True,
    export_yup=True,
)

# Check file size
file_size = os.path.getsize(OUTPUT_PATH)
print(f"[spike] GLB size: {file_size / 1024:.1f} KB")

# Report tri count
tri_count = sum(len(p.vertices) - 2 for p in obj.data.polygons)
print(f"[spike] Triangle count: {tri_count}")

elapsed = time.time() - start_time
print(f"[spike] Total time: {elapsed:.1f}s")
print("[spike] SPIKE TEST COMPLETE")
