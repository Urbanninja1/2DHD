import * as THREE from 'three';

/**
 * Detail Map Overlay — breaks tiling repetition on large surfaces.
 *
 * Injects a large-scale grunge/noise texture via onBeforeCompile that
 * modulates the diffuse color. The detail map tiles at a different
 * (non-integer) scale from the base texture, preventing the eye from
 * locking onto the base tile repeat pattern.
 */

/** Cached detail texture — shared across all materials that use it */
let cachedDetailTexture: THREE.CanvasTexture | null = null;

/**
 * Generate a tileable grunge/variation texture using multi-octave noise.
 * This creates subtle tonal variation — darker in some areas, lighter in
 * others — that breaks up the uniform repeat of the base texture.
 */
function createGrungeTexture(size = 512): THREE.CanvasTexture {
  if (cachedDetailTexture) return cachedDetailTexture;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Start with mid-gray base
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;

  // Seeded pseudo-random for reproducibility
  let seed = 42;
  const rand = () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Generate multi-octave value noise for organic variation
  // Octave 1: large blotches (low frequency)
  const grid1 = 8;
  const values1 = new Float32Array((grid1 + 1) * (grid1 + 1));
  for (let i = 0; i < values1.length; i++) values1[i] = rand();

  // Octave 2: medium detail
  const grid2 = 24;
  const values2 = new Float32Array((grid2 + 1) * (grid2 + 1));
  for (let i = 0; i < values2.length; i++) values2[i] = rand();

  // Octave 3: fine grain
  const grid3 = 64;
  const values3 = new Float32Array((grid3 + 1) * (grid3 + 1));
  for (let i = 0; i < values3.length; i++) values3[i] = rand();

  // Bilinear interpolation helper
  const sampleGrid = (values: Float32Array, gridSize: number, u: number, v: number): number => {
    const gx = u * gridSize;
    const gy = v * gridSize;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const x1 = x0 + 1;
    const y1 = y0 + 1;
    const fx = gx - x0;
    const fy = gy - y0;
    const stride = gridSize + 1;
    const v00 = values[y0 * stride + x0]!;
    const v10 = values[y0 * stride + x1]!;
    const v01 = values[y1 * stride + x0]!;
    const v11 = values[y1 * stride + x1]!;
    return (v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy);
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;

      // Combine octaves with decreasing amplitude
      const n1 = sampleGrid(values1, grid1, u, v) * 0.5;    // Large blotches
      const n2 = sampleGrid(values2, grid2, u, v) * 0.3;    // Medium detail
      const n3 = sampleGrid(values3, grid3, u, v) * 0.2;    // Fine grain
      const noise = n1 + n2 + n3; // Range: ~0.0 to ~1.0

      // Map to a useful range centered around 0.5 (neutral gray = no change)
      // Range: 0.65 to 1.0 — darkens some areas, leaves others neutral
      const value = Math.floor(0.65 * 255 + noise * 0.35 * 255);

      const idx = (y * size + x) * 4;
      data[idx] = value;
      data[idx + 1] = value;
      data[idx + 2] = value;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace; // Linear data, not sRGB
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;

  cachedDetailTexture = tex;
  return tex;
}

/**
 * Apply a detail map overlay to a MeshStandardMaterial via onBeforeCompile.
 *
 * The detail texture is multiplied into the diffuse color at a large scale
 * (non-integer relative to the base UV repeat), breaking visible tiling.
 *
 * @param material - The PBR material to modify
 * @param detailScale - UV scale for the detail map (default 0.7 — non-integer to avoid alignment with base tiles)
 * @param blendStrength - How much the detail affects the base (0 = none, 1 = full multiply). Default 0.35.
 */
export function applyDetailOverlay(
  material: THREE.MeshStandardMaterial,
  detailScale = 0.7,
  blendStrength = 0.35,
): void {
  const detailMap = createGrungeTexture();

  material.onBeforeCompile = (shader) => {
    shader.uniforms.detailMap = { value: detailMap };
    shader.uniforms.detailScale = { value: detailScale };
    shader.uniforms.detailBlend = { value: blendStrength };

    // Inject uniform declarations
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_pars_fragment>',
      /* glsl */ `#include <map_pars_fragment>
uniform sampler2D detailMap;
uniform float detailScale;
uniform float detailBlend;`,
    );

    // Multiply detail into diffuse after base map sampling
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      /* glsl */ `#include <map_fragment>
{
  vec2 detailUV = vMapUv * detailScale;
  float detail = texture2D( detailMap, detailUV ).r;
  // Remap: detail=1.0 → no change, detail=0.65 → darken by 35%
  float modulation = mix( 1.0, detail, detailBlend );
  diffuseColor.rgb *= modulation;
}`,
    );
  };

  // Mark material for recompilation
  material.needsUpdate = true;
}
