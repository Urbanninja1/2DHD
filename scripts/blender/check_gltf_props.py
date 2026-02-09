import bpy
props = bpy.ops.export_scene.gltf.get_rna_type().properties
for p in props:
    print(f"{p.identifier}: {p.type}")
    if hasattr(p, 'enum_items'):
        for item in p.enum_items:
            print(f"  - {item.identifier}: {item.name}")
