"""GLB export utilities for the Blender asset pipeline."""
import bpy
import os
from .conventions import MAX_GLB_KB, JPEG_QUALITY


def prepare_for_export(obj):
    """Prepare an object for GLB export: triangulate, apply transforms."""
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)

    # Triangulate (required for tangent export)
    tri_mod = obj.modifiers.new('Triangulate', 'TRIANGULATE')
    bpy.ops.object.modifier_apply(modifier='Triangulate')

    # Apply transforms
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)


def export_glb(obj, output_path, jpeg_quality=JPEG_QUALITY):
    """Export the active object as a GLB with JPEG-compressed embedded textures.

    Args:
        obj: The object to export.
        output_path: Absolute path for the .glb file.
        jpeg_quality: JPEG quality (0-100) for embedded textures.

    Returns:
        dict with metadata: file_size_kb, tri_count, height.
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)

    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_tangents=True,
        export_yup=True,
        export_image_format='JPEG',
        export_image_quality=jpeg_quality,
    )

    file_size_kb = os.path.getsize(output_path) / 1024
    tri_count = sum(len(p.vertices) - 2 for p in obj.data.polygons)

    # Get bounding box height
    if obj.data.vertices:
        min_z = min(v.co.z for v in obj.data.vertices)
        max_z = max(v.co.z for v in obj.data.vertices)
        height = max_z - min_z
    else:
        height = 0

    if file_size_kb > MAX_GLB_KB:
        print(f"  WARNING: GLB {file_size_kb:.1f}KB exceeds {MAX_GLB_KB}KB budget!")

    return {
        'file_size_kb': file_size_kb,
        'tri_count': tri_count,
        'height': height,
    }
