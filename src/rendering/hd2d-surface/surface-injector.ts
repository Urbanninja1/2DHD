/**
 * Surface detail injector — wraps MeshStandardMaterial with onBeforeCompile
 * to add triplanar detail normal, stochastic tiling, and grunge overlay.
 *
 * Three.js r182 source uses GLSL 1.0 conventions (WebGLProgram auto-upgrades):
 * - texture2D → texture (via #define)
 * - varying → in/out (via #define)
 * - texture2DGradEXT → textureGrad (via #define)
 *
 * Must set customProgramCacheKey for unique shader programs.
 */
import * as THREE from 'three';
import { TRIPLANAR_DETAIL_NORMAL, STOCHASTIC_TILING, GRUNGE_OVERLAY } from './surface-shaders.js';

export interface SurfaceDetailConfig {
  detailNormalTex: THREE.Texture | null;
  grungeTex: THREE.Texture | null;
  detailScale: number;       // default 6.0
  detailIntensity: number;   // default 0.3
  grungeScale: number;       // default 0.1
  grungeIntensity: number;   // default 0.35
  enableStochastic: boolean; // default true
}

/** Handle for runtime uniform updates (used by quality scaler) */
export interface SurfaceDetailHandle {
  setGrungeIntensity(v: number): void;
  setDetailIntensity(v: number): void;
  setStochasticEnabled(v: boolean): void;
}

/** Version string for cache key — bump when GLSL changes */
const SHADER_VERSION = 'hd2d-surface-v1';

/**
 * Inject surface detail layers into a MeshStandardMaterial.
 * Wraps onBeforeCompile to add triplanar detail normal, stochastic tiling,
 * and grunge overlay. Returns a handle for runtime uniform control.
 *
 * Safe: wraps the callback in try/catch — on shader failure, material
 * falls back to unmodified PBR.
 */
export function injectSurfaceDetail(
  material: THREE.MeshStandardMaterial,
  config: SurfaceDetailConfig,
): SurfaceDetailHandle {
  const hasDetail = config.detailNormalTex !== null;
  const hasGrunge = config.grungeTex !== null;
  const hasStochastic = config.enableStochastic;

  // Build a unique cache key from active features
  const cacheFlags = [
    hasDetail ? 'D' : '',
    hasGrunge ? 'G' : '',
    hasStochastic ? 'S' : '',
  ].join('');

  material.customProgramCacheKey = () => `${SHADER_VERSION}-${cacheFlags}`;

  // Uniform refs — populated inside onBeforeCompile, read by handle
  let uDetailIntensity: THREE.IUniform<number> | null = null;
  let uGrungeIntensity: THREE.IUniform<number> | null = null;
  let uEnableStochastic: THREE.IUniform<number> | null = null;

  material.onBeforeCompile = (shader) => {
    try {
      // --- Merge custom uniforms ---
      const uniforms: Record<string, THREE.IUniform> = {};

      if (hasDetail) {
        uniforms.uDetailNormal = { value: config.detailNormalTex };
        uniforms.uDetailScale = { value: config.detailScale };
        uDetailIntensity = { value: config.detailIntensity };
        uniforms.uDetailIntensity = uDetailIntensity;
      }

      if (hasGrunge) {
        uniforms.uGrungeMap = { value: config.grungeTex };
        uniforms.uGrungeScale = { value: config.grungeScale };
        uGrungeIntensity = { value: config.grungeIntensity };
        uniforms.uGrungeIntensity = uGrungeIntensity;
      }

      if (hasStochastic) {
        uEnableStochastic = { value: 1.0 };
        uniforms.uEnableStochastic = uEnableStochastic;
      }

      Object.assign(shader.uniforms, uniforms);

      // --- Vertex shader: add world-space varyings ---
      // Three.js uses `varying` in source (auto-upgraded to out/in by WebGLProgram)
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
varying vec3 vWorldPos;
varying vec3 vWorldNrm;`,
      );

      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWorldNrm = normalize(mat3(modelMatrix) * objectNormal);`,
      );

      // --- Fragment shader: declare uniforms, varyings, helpers ---
      const fragmentHeader = buildFragmentHeader(hasDetail, hasGrunge, hasStochastic);
      shader.fragmentShader = shader.fragmentShader.replace(
        '#define STANDARD',
        `#define STANDARD
${fragmentHeader}`,
      );

      // --- Hook: stochastic tiling replaces map_fragment ---
      if (hasStochastic) {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <map_fragment>',
          buildStochasticMapFragment(),
        );
      }

      // --- Hook: detail normal after normal_fragment_maps ---
      if (hasDetail) {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
normal = normalize(normal + triplanarDetailNormal(vWorldPos, vWorldNrm, uDetailNormal, uDetailScale) * uDetailIntensity);`,
        );
      }

      // --- Hook: grunge multiply after roughnessmap_fragment ---
      if (hasGrunge) {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
{
    float grunge = triplanarGrunge(vWorldPos, vWorldNrm, uGrungeMap, uGrungeScale);
    diffuseColor.rgb *= mix(1.0, grunge, uGrungeIntensity);
}`,
        );
      }

      // Store shader ref for debug access
      material.userData.shader = shader;
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn('[surface-injector] Shader injection failed, falling back to base PBR:', e);
      }
    }
  };

  // Return handle for quality scaler
  return {
    setGrungeIntensity(v: number) {
      if (uGrungeIntensity) uGrungeIntensity.value = v;
    },
    setDetailIntensity(v: number) {
      if (uDetailIntensity) uDetailIntensity.value = v;
    },
    setStochasticEnabled(v: boolean) {
      if (uEnableStochastic) uEnableStochastic.value = v ? 1.0 : 0.0;
    },
  };
}

// --- Fragment header builder ---

function buildFragmentHeader(
  hasDetail: boolean,
  hasGrunge: boolean,
  hasStochastic: boolean,
): string {
  const lines: string[] = [];

  // Varyings — use `varying` (Three.js defines it to `in` for fragment shaders)
  lines.push('varying vec3 vWorldPos;');
  lines.push('varying vec3 vWorldNrm;');

  // Detail normal uniforms + helper
  if (hasDetail) {
    lines.push('uniform sampler2D uDetailNormal;');
    lines.push('uniform float uDetailScale;');
    lines.push('uniform float uDetailIntensity;');
    lines.push(TRIPLANAR_DETAIL_NORMAL);
  }

  // Grunge uniforms + helper
  if (hasGrunge) {
    lines.push('uniform sampler2D uGrungeMap;');
    lines.push('uniform float uGrungeScale;');
    lines.push('uniform float uGrungeIntensity;');
    lines.push(GRUNGE_OVERLAY);
  }

  // Stochastic tiling helper
  if (hasStochastic) {
    lines.push('uniform float uEnableStochastic;');
    lines.push(STOCHASTIC_TILING);
  }

  return lines.join('\n');
}

// --- Stochastic map_fragment replacement ---

function buildStochasticMapFragment(): string {
  // Replaces #include <map_fragment> with a stochastic version.
  // Matches the original Three.js r182 map_fragment structure (no mapTexelToLinear).
  // When uEnableStochastic is 0, falls back to standard texture2D.
  return /* glsl */`
#ifdef USE_MAP
    vec4 sampledDiffuseColor;
    if (uEnableStochastic > 0.5) {
        sampledDiffuseColor = textureNoTile(map, vMapUv);
    } else {
        sampledDiffuseColor = texture2D(map, vMapUv);
    }
    #ifdef DECODE_VIDEO_TEXTURE
        sampledDiffuseColor = sRGBTransferEOTF(sampledDiffuseColor);
    #endif
    diffuseColor *= sampledDiffuseColor;
#endif`;
}
