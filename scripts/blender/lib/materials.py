"""Parameterized material factories for the Blender asset pipeline.

Each factory creates a Blender material with procedural shader nodes.
Materials must be BAKED to image textures before GLB export (procedural
nodes are silently dropped in glTF).
"""
import bpy


def create_northern_stone(name='NorthernStone', scale=4.0, seed=0):
    """Create a grey stone material with Voronoi block pattern and FBM grain."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (600, 0)

    principled = nodes.new('ShaderNodeBsdfPrincipled')
    principled.location = (300, 0)
    principled.inputs['Roughness'].default_value = 0.85
    principled.inputs['Specular IOR Level'].default_value = 0.3
    principled.inputs['Metallic'].default_value = 0.0
    links.new(principled.outputs['BSDF'], output.inputs['Surface'])

    tex_coord = nodes.new('ShaderNodeTexCoord')
    tex_coord.location = (-1000, 0)
    mapping = nodes.new('ShaderNodeMapping')
    mapping.location = (-800, 0)
    mapping.inputs['Scale'].default_value = (scale, scale, scale)
    links.new(tex_coord.outputs['Object'], mapping.inputs['Vector'])

    # FBM noise for stone grain
    noise = nodes.new('ShaderNodeTexNoise')
    noise.location = (-500, 100)
    noise.noise_type = 'FBM'
    noise.inputs['Scale'].default_value = 6.0
    noise.inputs['Detail'].default_value = 8.0
    noise.inputs['Roughness'].default_value = 0.6
    links.new(mapping.outputs['Vector'], noise.inputs['Vector'])

    # Voronoi for block pattern
    voronoi = nodes.new('ShaderNodeTexVoronoi')
    voronoi.location = (-500, -200)
    voronoi.inputs['Scale'].default_value = 3.0
    voronoi.feature = 'F1'
    links.new(mapping.outputs['Vector'], voronoi.inputs['Vector'])

    # Mix patterns
    mix_pat = nodes.new('ShaderNodeMix')
    mix_pat.location = (-250, 0)
    mix_pat.data_type = 'FLOAT'
    mix_pat.inputs['Factor'].default_value = 0.3
    links.new(noise.outputs['Fac'], mix_pat.inputs[2])
    links.new(voronoi.outputs['Distance'], mix_pat.inputs[3])

    # Color ramp: grey stone palette
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.location = (0, 100)
    ramp.color_ramp.elements[0].position = 0.3
    ramp.color_ramp.elements[0].color = (0.29, 0.27, 0.25, 1.0)
    ramp.color_ramp.elements[1].position = 0.7
    ramp.color_ramp.elements[1].color = (0.42, 0.40, 0.37, 1.0)
    links.new(mix_pat.outputs[0], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], principled.inputs['Base Color'])

    # Bump
    bump = nodes.new('ShaderNodeBump')
    bump.location = (100, -200)
    bump.inputs['Strength'].default_value = 0.3
    links.new(noise.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], principled.inputs['Normal'])

    return mat


def create_ironwood(name='Ironwood', scale=2.0, grain_density=3.0, seed=0):
    """Create dark ironwood material with vertical grain and knots."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (600, 0)

    principled = nodes.new('ShaderNodeBsdfPrincipled')
    principled.location = (300, 0)
    principled.inputs['Roughness'].default_value = 0.65
    principled.inputs['Specular IOR Level'].default_value = 0.35
    principled.inputs['Metallic'].default_value = 0.0
    links.new(principled.outputs['BSDF'], output.inputs['Surface'])

    tex_coord = nodes.new('ShaderNodeTexCoord')
    tex_coord.location = (-1000, 0)
    mapping = nodes.new('ShaderNodeMapping')
    mapping.location = (-800, 0)
    mapping.inputs['Scale'].default_value = (scale, scale, scale * 4)
    links.new(tex_coord.outputs['Object'], mapping.inputs['Vector'])

    # Wave for grain
    wave = nodes.new('ShaderNodeTexWave')
    wave.location = (-600, 200)
    wave.wave_type = 'BANDS'
    wave.bands_direction = 'Z'
    wave.inputs['Scale'].default_value = grain_density
    wave.inputs['Distortion'].default_value = 4.0
    wave.inputs['Detail'].default_value = 4.0
    links.new(mapping.outputs['Vector'], wave.inputs['Vector'])

    # Noise for variation
    noise = nodes.new('ShaderNodeTexNoise')
    noise.location = (-600, -100)
    noise.noise_type = 'FBM'
    noise.inputs['Scale'].default_value = 12.0
    noise.inputs['Detail'].default_value = 6.0
    links.new(mapping.outputs['Vector'], noise.inputs['Vector'])

    # Voronoi for knots
    voronoi = nodes.new('ShaderNodeTexVoronoi')
    voronoi.location = (-600, -350)
    voronoi.inputs['Scale'].default_value = 2.0
    voronoi.feature = 'F1'
    links.new(mapping.outputs['Vector'], voronoi.inputs['Vector'])

    # Mix grain patterns
    mix1 = nodes.new('ShaderNodeMix')
    mix1.location = (-350, 100)
    mix1.data_type = 'FLOAT'
    mix1.inputs['Factor'].default_value = 0.3
    links.new(wave.outputs['Fac'], mix1.inputs[2])
    links.new(noise.outputs['Fac'], mix1.inputs[3])

    mix2 = nodes.new('ShaderNodeMix')
    mix2.location = (-200, 50)
    mix2.data_type = 'FLOAT'
    mix2.inputs['Factor'].default_value = 0.15
    links.new(mix1.outputs[0], mix2.inputs[2])
    links.new(voronoi.outputs['Distance'], mix2.inputs[3])

    # Color ramp: dark ironwood
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.location = (0, 100)
    ramp.color_ramp.elements[0].position = 0.3
    ramp.color_ramp.elements[0].color = (0.176, 0.133, 0.094, 1.0)
    ramp.color_ramp.elements[1].position = 0.7
    ramp.color_ramp.elements[1].color = (0.290, 0.208, 0.145, 1.0)
    links.new(mix2.outputs[0], ramp.inputs['Fac'])
    links.new(ramp.outputs['Color'], principled.inputs['Base Color'])

    # Roughness variation
    rough_ramp = nodes.new('ShaderNodeValToRGB')
    rough_ramp.location = (0, -150)
    rough_ramp.color_ramp.elements[0].position = 0.3
    rough_ramp.color_ramp.elements[0].color = (0.55, 0.55, 0.55, 1.0)
    rough_ramp.color_ramp.elements[1].position = 0.7
    rough_ramp.color_ramp.elements[1].color = (0.75, 0.75, 0.75, 1.0)
    links.new(mix1.outputs[0], rough_ramp.inputs['Fac'])
    links.new(rough_ramp.outputs['Color'], principled.inputs['Roughness'])

    # Bump
    bump = nodes.new('ShaderNodeBump')
    bump.location = (100, -300)
    bump.inputs['Strength'].default_value = 0.2
    links.new(mix2.outputs[0], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], principled.inputs['Normal'])

    return mat


def create_dark_iron(name='DarkIron', scale=8.0, seed=0):
    """Create aged dark iron/metal material with scratches."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (600, 0)

    principled = nodes.new('ShaderNodeBsdfPrincipled')
    principled.location = (300, 0)
    principled.inputs['Roughness'].default_value = 0.45
    principled.inputs['Metallic'].default_value = 0.9
    principled.inputs['Specular IOR Level'].default_value = 0.5
    principled.inputs['Base Color'].default_value = (0.18, 0.18, 0.18, 1.0)
    links.new(principled.outputs['BSDF'], output.inputs['Surface'])

    tex_coord = nodes.new('ShaderNodeTexCoord')
    tex_coord.location = (-800, 0)
    mapping = nodes.new('ShaderNodeMapping')
    mapping.location = (-600, 0)
    mapping.inputs['Scale'].default_value = (scale, scale, scale)
    links.new(tex_coord.outputs['Object'], mapping.inputs['Vector'])

    # Noise for surface variation
    noise = nodes.new('ShaderNodeTexNoise')
    noise.location = (-400, 100)
    noise.noise_type = 'FBM'
    noise.inputs['Scale'].default_value = 20.0
    noise.inputs['Detail'].default_value = 4.0
    links.new(mapping.outputs['Vector'], noise.inputs['Vector'])

    # Scratches via wave
    wave = nodes.new('ShaderNodeTexWave')
    wave.location = (-400, -150)
    wave.wave_type = 'BANDS'
    wave.inputs['Scale'].default_value = 15.0
    wave.inputs['Distortion'].default_value = 8.0
    wave.inputs['Detail'].default_value = 3.0
    links.new(mapping.outputs['Vector'], wave.inputs['Vector'])

    # Mix for roughness variation (scratched areas are shinier)
    rough_mix = nodes.new('ShaderNodeMix')
    rough_mix.location = (-100, 0)
    rough_mix.data_type = 'FLOAT'
    rough_mix.inputs['Factor'].default_value = 0.3
    rough_mix.inputs[2].default_value = 0.45  # Base roughness
    links.new(wave.outputs['Fac'], rough_mix.inputs[3])
    links.new(rough_mix.outputs[0], principled.inputs['Roughness'])

    # Bump
    bump = nodes.new('ShaderNodeBump')
    bump.location = (100, -200)
    bump.inputs['Strength'].default_value = 0.15
    links.new(noise.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], principled.inputs['Normal'])

    return mat


def create_leather(name='Leather', base_color=(0.30, 0.20, 0.12), seed=0):
    """Create leather material with subtle grain."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (600, 0)

    principled = nodes.new('ShaderNodeBsdfPrincipled')
    principled.location = (300, 0)
    principled.inputs['Roughness'].default_value = 0.6
    principled.inputs['Metallic'].default_value = 0.0
    principled.inputs['Base Color'].default_value = (*base_color, 1.0)
    links.new(principled.outputs['BSDF'], output.inputs['Surface'])

    tex_coord = nodes.new('ShaderNodeTexCoord')
    tex_coord.location = (-800, 0)
    mapping = nodes.new('ShaderNodeMapping')
    mapping.location = (-600, 0)
    mapping.inputs['Scale'].default_value = (6.0, 6.0, 6.0)
    links.new(tex_coord.outputs['Object'], mapping.inputs['Vector'])

    # Voronoi for leather grain
    voronoi = nodes.new('ShaderNodeTexVoronoi')
    voronoi.location = (-400, 0)
    voronoi.inputs['Scale'].default_value = 15.0
    voronoi.feature = 'F1'
    links.new(mapping.outputs['Vector'], voronoi.inputs['Vector'])

    # Bump from grain
    bump = nodes.new('ShaderNodeBump')
    bump.location = (100, -200)
    bump.inputs['Strength'].default_value = 0.1
    links.new(voronoi.outputs['Distance'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], principled.inputs['Normal'])

    return mat
