/**
 * GLB Bounding Box Reader
 *
 * Reads a GLB file and extracts the axis-aligned bounding box from
 * POSITION accessor min/max values. No Three.js or GPU required.
 */
import { readFileSync } from 'node:fs';

const GLB_MAGIC = 0x46546C67; // 'glTF'
const JSON_CHUNK = 0x4E4F534A; // 'JSON'
const FLOAT = 5126;            // GL_FLOAT component type
const VEC3 = 'VEC3';

/**
 * Read axis-aligned bounding box from a GLB file.
 * @param {string} glbPath - Absolute or relative path to .glb file
 * @returns {{ min: {x: number, y: number, z: number}, max: {x: number, y: number, z: number} }}
 */
export function readModelBounds(glbPath) {
  const buf = readFileSync(glbPath);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  // Validate GLB header
  if (view.getUint32(0, true) !== GLB_MAGIC) {
    throw new Error(`Not a GLB file: ${glbPath}`);
  }

  // Read JSON chunk (first chunk after 12-byte header)
  const chunkLength = view.getUint32(12, true);
  const chunkType = view.getUint32(16, true);
  if (chunkType !== JSON_CHUNK) {
    throw new Error(`First chunk is not JSON in: ${glbPath}`);
  }

  const jsonStr = new TextDecoder().decode(buf.subarray(20, 20 + chunkLength));
  const gltf = JSON.parse(jsonStr);

  if (!gltf.accessors || gltf.accessors.length === 0) {
    throw new Error(`No accessors found in: ${glbPath}`);
  }

  // Find all VEC3/FLOAT POSITION accessors with min/max
  const bounds = { min: { x: Infinity, y: Infinity, z: Infinity }, max: { x: -Infinity, y: -Infinity, z: -Infinity } };
  let found = false;

  // Check meshes for POSITION attributes and use their accessor indices
  const positionAccessorIndices = new Set();
  if (gltf.meshes) {
    for (const mesh of gltf.meshes) {
      for (const prim of mesh.primitives) {
        if (prim.attributes && prim.attributes.POSITION !== undefined) {
          positionAccessorIndices.add(prim.attributes.POSITION);
        }
      }
    }
  }

  for (const idx of positionAccessorIndices) {
    const acc = gltf.accessors[idx];
    if (!acc || acc.type !== VEC3 || acc.componentType !== FLOAT) continue;
    if (!acc.min || !acc.max) continue;

    found = true;
    bounds.min.x = Math.min(bounds.min.x, acc.min[0]);
    bounds.min.y = Math.min(bounds.min.y, acc.min[1]);
    bounds.min.z = Math.min(bounds.min.z, acc.min[2]);
    bounds.max.x = Math.max(bounds.max.x, acc.max[0]);
    bounds.max.y = Math.max(bounds.max.y, acc.max[1]);
    bounds.max.z = Math.max(bounds.max.z, acc.max[2]);
  }

  if (!found) {
    throw new Error(`No POSITION accessors with min/max found in: ${glbPath}`);
  }

  return bounds;
}
