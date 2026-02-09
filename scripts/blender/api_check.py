"""Check Blender 5.x API for shader node compatibility."""
import bpy

bpy.ops.mesh.primitive_cube_add()
obj = bpy.context.active_object
mat = bpy.data.materials.new('test')
mat.use_nodes = True
nodes = mat.node_tree.nodes

# Check if Musgrave Texture node still exists
try:
    m = nodes.new('ShaderNodeTexMusgrave')
    print(f'MUSGRAVE: EXISTS (type={m.bl_idname})')
    nodes.remove(m)
except Exception as e:
    print(f'MUSGRAVE: REMOVED ({e})')

# Check Noise Texture and noise_type options
n = nodes.new('ShaderNodeTexNoise')
print(f'NOISE: {n.bl_idname}')
if hasattr(n, 'noise_type'):
    items = [e.identifier for e in n.bl_rna.properties['noise_type'].enum_items]
    print(f'NOISE_TYPE OPTIONS: {items}')
else:
    print('NOISE_TYPE: not found as attribute')
    # Check all properties
    props = [p.identifier for p in n.bl_rna.properties]
    print(f'NOISE PROPS: {props}')

nodes.remove(n)

# Check Voronoi
v = nodes.new('ShaderNodeTexVoronoi')
print(f'VORONOI: {v.bl_idname}')
nodes.remove(v)

# Check Wave
w = nodes.new('ShaderNodeTexWave')
print(f'WAVE: {w.bl_idname}')
nodes.remove(w)

# Check Principled BSDF input names
p = nodes.get('Principled BSDF')
if p:
    names = [inp.name for inp in p.inputs]
    print(f'PRINCIPLED INPUTS: {names}')
else:
    print('PRINCIPLED BSDF: not found in default material')

# Check bake API
print(f'BAKE OPS: {hasattr(bpy.ops.object, "bake")}')

# Cleanup
bpy.data.objects.remove(obj)
bpy.data.materials.remove(mat)

print('API CHECK COMPLETE')
