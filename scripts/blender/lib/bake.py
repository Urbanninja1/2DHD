"""PBR texture baking pipeline for the Blender asset pipeline.

Bakes diffuse, normal, roughness, and AO maps from procedural materials
to image textures. The baked images are used for GLB export since
procedural shader nodes are silently dropped in glTF format.
"""
import bpy
from .conventions import BAKE_SAMPLES_FAST, BAKE_SAMPLES_AO


def setup_cycles_bake():
    """Configure Cycles renderer for baking."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = BAKE_SAMPLES_FAST


def bake_pbr(obj, tex_size, skip_ao=False):
    """Bake all PBR passes for an object.

    Args:
        obj: The Blender object to bake.
        tex_size: Resolution (e.g., 512 for 512x512).
        skip_ao: If True, skip AO bake (for wall-hugging decals).

    Returns:
        dict mapping pass name to bpy.types.Image.
    """
    setup_cycles_bake()
    scene = bpy.context.scene
    mat = obj.data.materials[0]
    nodes = mat.node_tree.nodes

    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)

    images = {}
    passes = [
        ('DIFFUSE', 'sRGB', BAKE_SAMPLES_FAST, {'COLOR'}),
        ('NORMAL', 'Non-Color', BAKE_SAMPLES_FAST, None),
        ('ROUGHNESS', 'Non-Color', BAKE_SAMPLES_FAST, None),
    ]
    if not skip_ao:
        passes.append(('AO', 'Non-Color', BAKE_SAMPLES_AO, None))

    for pass_type, colorspace, samples, pass_filter in passes:
        img = bpy.data.images.new(f"bake_{pass_type.lower()}", tex_size, tex_size)
        img.colorspace_settings.name = colorspace

        # Create temp image texture node and make it active (CRITICAL)
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
        images[pass_type] = img
        print(f"  Baked {pass_type}")

    return images


def replace_material_with_baked(obj, images):
    """Replace procedural material with baked image textures for GLB export.

    This is necessary because procedural Blender nodes are silently dropped
    when exporting to glTF/GLB format.
    """
    mat = obj.data.materials[0]
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (400, 0)

    principled = nodes.new('ShaderNodeBsdfPrincipled')
    principled.location = (100, 0)
    principled.inputs['Metallic'].default_value = 0.0
    links.new(principled.outputs['BSDF'], output.inputs['Surface'])

    # Diffuse
    diff_node = nodes.new('ShaderNodeTexImage')
    diff_node.location = (-300, 200)
    diff_node.image = images['DIFFUSE']

    if 'AO' in images:
        # AO multiply into diffuse
        ao_node = nodes.new('ShaderNodeTexImage')
        ao_node.location = (-500, 100)
        ao_node.image = images['AO']
        ao_node.image.colorspace_settings.name = 'Non-Color'

        ao_mix = nodes.new('ShaderNodeMix')
        ao_mix.location = (-100, 200)
        ao_mix.data_type = 'RGBA'
        ao_mix.blend_type = 'MULTIPLY'
        ao_mix.inputs['Factor'].default_value = 1.0
        links.new(diff_node.outputs['Color'], ao_mix.inputs[6])
        links.new(ao_node.outputs['Color'], ao_mix.inputs[7])
        links.new(ao_mix.outputs[2], principled.inputs['Base Color'])
    else:
        links.new(diff_node.outputs['Color'], principled.inputs['Base Color'])

    # Normal map
    norm_node = nodes.new('ShaderNodeTexImage')
    norm_node.location = (-500, -200)
    norm_node.image = images['NORMAL']
    norm_node.image.colorspace_settings.name = 'Non-Color'

    normal_map = nodes.new('ShaderNodeNormalMap')
    normal_map.location = (-200, -200)
    normal_map.inputs['Strength'].default_value = 1.0
    links.new(norm_node.outputs['Color'], normal_map.inputs['Color'])
    links.new(normal_map.outputs['Normal'], principled.inputs['Normal'])

    # Roughness
    rough_node = nodes.new('ShaderNodeTexImage')
    rough_node.location = (-300, -50)
    rough_node.image = images['ROUGHNESS']
    rough_node.image.colorspace_settings.name = 'Non-Color'
    links.new(rough_node.outputs['Color'], principled.inputs['Roughness'])
