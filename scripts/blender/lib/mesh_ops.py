"""Common mesh operations for the Blender asset pipeline."""
import bpy
import bmesh
import math


def clean_scene():
    """Remove all objects, materials, meshes, and images."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for block in list(bpy.data.materials):
        bpy.data.materials.remove(block)
    for block in list(bpy.data.meshes):
        bpy.data.meshes.remove(block)
    for block in list(bpy.data.images):
        bpy.data.images.remove(block)


def add_bevel(obj, width=0.02, segments=2, angle_limit=0.7854):
    """Add and apply a bevel modifier."""
    bevel = obj.modifiers.new('Bevel', 'BEVEL')
    bevel.width = width
    bevel.segments = segments
    bevel.limit_method = 'ANGLE'
    bevel.angle_limit = angle_limit
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier='Bevel')


def smooth_shade(obj):
    """Apply smooth shading."""
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.shade_smooth()


def smart_uv_unwrap(obj, angle_limit=1.15192, island_margin=0.02):
    """UV unwrap using Smart UV Project."""
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=angle_limit, island_margin=island_margin)
    bpy.ops.object.mode_set(mode='OBJECT')


def remove_doubles(obj, threshold=0.001):
    """Merge vertices closer than threshold."""
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=threshold)
    bpy.ops.object.mode_set(mode='OBJECT')


def join_objects(objects):
    """Join multiple objects into one."""
    if len(objects) <= 1:
        return objects[0] if objects else None

    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    return bpy.context.active_object


def set_origin_base_center(obj):
    """Set origin to the bottom center of the bounding box."""
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)

    # First set origin to geometry center
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')

    # Then shift so origin is at bottom
    bbox = obj.bound_box
    min_z = min(v[2] for v in bbox)
    # Move all vertices up so the base is at z=0
    for v in obj.data.vertices:
        v.co.z -= min_z
    obj.location.z = 0


def create_cylinder_section(bm, radius_bottom, radius_top, height, segments, z_offset):
    """Create a cylinder section in a BMesh."""
    verts_bottom = []
    verts_top = []
    for i in range(segments):
        angle = 2 * math.pi * i / segments
        x_b = radius_bottom * math.cos(angle)
        y_b = radius_bottom * math.sin(angle)
        verts_bottom.append(bm.verts.new((x_b, y_b, z_offset)))
        x_t = radius_top * math.cos(angle)
        y_t = radius_top * math.sin(angle)
        verts_top.append(bm.verts.new((x_t, y_t, z_offset + height)))

    for i in range(segments):
        j = (i + 1) % segments
        bm.faces.new([verts_bottom[i], verts_bottom[j], verts_top[j], verts_top[i]])

    bm.faces.new(verts_bottom)
    bm.faces.new(list(reversed(verts_top)))
    return verts_bottom, verts_top


def create_box(bm, width, height, depth, x=0, y=0, z=0):
    """Create a box in a BMesh at the given position (centered on x,y, base at z)."""
    hw, hd = width / 2, depth / 2
    verts = [
        bm.verts.new((x - hw, y - hd, z)),
        bm.verts.new((x + hw, y - hd, z)),
        bm.verts.new((x + hw, y + hd, z)),
        bm.verts.new((x - hw, y + hd, z)),
        bm.verts.new((x - hw, y - hd, z + height)),
        bm.verts.new((x + hw, y - hd, z + height)),
        bm.verts.new((x + hw, y + hd, z + height)),
        bm.verts.new((x - hw, y + hd, z + height)),
    ]
    # Bottom
    bm.faces.new([verts[3], verts[2], verts[1], verts[0]])
    # Top
    bm.faces.new([verts[4], verts[5], verts[6], verts[7]])
    # Front
    bm.faces.new([verts[0], verts[1], verts[5], verts[4]])
    # Back
    bm.faces.new([verts[2], verts[3], verts[7], verts[6]])
    # Left
    bm.faces.new([verts[3], verts[0], verts[4], verts[7]])
    # Right
    bm.faces.new([verts[1], verts[2], verts[6], verts[5]])
    return verts
