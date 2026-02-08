import * as THREE from 'three';

/**
 * Per-room performance profiler.
 * Logs renderer.info metrics on room load and tracks delta to detect leaks.
 * Estimates VRAM usage from scene traversal.
 *
 * Budget targets (from plan):
 * - < 60 draw calls per room
 * - < 200MB total VRAM (desktop)
 * - < 100MB total VRAM (mobile)
 * - 60fps sustained
 */

/** VRAM budget in bytes */
const VRAM_BUDGET_DESKTOP = 200 * 1024 * 1024; // 200 MB
const VRAM_BUDGET_MOBILE = 100 * 1024 * 1024;  // 100 MB

interface RoomSnapshot {
  roomId: number;
  roomName: string;
  drawCalls: number;
  triangles: number;
  textures: number;
  geometries: number;
  estimatedVRAM: number;
  timestamp: number;
}

const history: RoomSnapshot[] = [];

/**
 * Estimate VRAM bytes for a single texture.
 * Accounts for mipmaps (~33% overhead) and pixel format.
 */
function estimateTextureVRAM(texture: THREE.Texture): number {
  const img = texture.image as { width?: number; height?: number } | null;
  if (!img || !img.width || !img.height) return 0;

  const w = img.width;
  const h = img.height;

  // Bytes per pixel depends on format
  let bpp = 4; // Default RGBA 8-bit
  if (texture.format === THREE.RGBAFormat) {
    bpp = texture.type === THREE.HalfFloatType ? 8
      : texture.type === THREE.FloatType ? 16
      : 4;
  } else if (texture.format === THREE.RGBFormat) {
    bpp = texture.type === THREE.HalfFloatType ? 6
      : texture.type === THREE.FloatType ? 12
      : 3;
  }

  // Check for compressed texture (KTX2/Basis)
  if ('isCompressedTexture' in texture && (texture as { isCompressedTexture?: boolean }).isCompressedTexture) {
    // Compressed textures are typically 0.5-1.0 bytes per pixel
    bpp = 1;
  }

  const baseSize = w * h * bpp;
  // Mipmaps add ~33% if generated
  const mipmapFactor = texture.generateMipmaps ? 1.33 : 1.0;

  return Math.ceil(baseSize * mipmapFactor);
}

/**
 * Estimate VRAM bytes for a geometry's vertex buffers + index buffer.
 */
function estimateGeometryVRAM(geometry: THREE.BufferGeometry): number {
  let bytes = 0;

  for (const name in geometry.attributes) {
    const attr = geometry.getAttribute(name);
    if (attr && 'array' in attr) {
      bytes += (attr as THREE.BufferAttribute).array.byteLength;
    }
  }

  if (geometry.index && 'array' in geometry.index) {
    bytes += geometry.index.array.byteLength;
  }

  return bytes;
}

/**
 * Estimate total VRAM usage by traversing the renderer's scene.
 * Walks all objects to collect unique textures and geometries.
 */
export function estimateSceneVRAM(renderer: THREE.WebGLRenderer): number {
  const seenTextures = new Set<number>();
  const seenGeometries = new Set<number>();
  let totalVRAM = 0;

  // We can't traverse the scene from here, but we can estimate from renderer.info counts
  // and use a heuristic based on typical texture/geometry sizes.
  // For more accurate estimates, call estimateVRAMFromScene() with direct scene access.

  // Estimate from renderer info: assume average texture is 512x512 RGBA + mipmaps
  const avgTexSize = 512 * 512 * 4 * 1.33;
  totalVRAM += renderer.info.memory.textures * avgTexSize;

  // Estimate geometries: assume average geometry is ~10KB
  totalVRAM += renderer.info.memory.geometries * 10240;

  // Shadow maps: each 2048x2048 shadow map is ~16MB (depth + color)
  // Rough estimate: 1 shadow map per scene
  totalVRAM += 2048 * 2048 * 4;

  // Render targets (EffectComposer): HalfFloat at window resolution
  // Typically 2-3 render targets for post-processing
  const w = renderer.domElement.clientWidth;
  const h = renderer.domElement.clientHeight;
  totalVRAM += w * h * 8 * 3; // 3 HalfFloat RGBA targets

  return totalVRAM;
}

/**
 * Estimate VRAM by directly traversing a scene graph.
 * More accurate than estimateSceneVRAM() but requires scene access.
 */
export function estimateVRAMFromScene(scene: THREE.Scene, renderer: THREE.WebGLRenderer): number {
  const seenTextures = new Set<number>();
  const seenGeometries = new Set<number>();
  let textureVRAM = 0;
  let geometryVRAM = 0;

  scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
      // Geometry
      const geo = obj.geometry;
      if (geo && !seenGeometries.has(geo.id)) {
        seenGeometries.add(geo.id);
        geometryVRAM += estimateGeometryVRAM(geo);
      }

      // Materials — collect textures
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of materials) {
        if (!mat) continue;
        const texProps = ['map', 'normalMap', 'roughnessMap', 'aoMap', 'emissiveMap', 'metalnessMap'] as const;
        for (const prop of texProps) {
          const tex = (mat as Record<string, unknown>)[prop] as THREE.Texture | undefined;
          if (tex && !seenTextures.has(tex.id)) {
            seenTextures.add(tex.id);
            textureVRAM += estimateTextureVRAM(tex);
          }
        }
      }
    }

    // Shadow maps
    if (obj instanceof THREE.DirectionalLight && obj.shadow.map) {
      const sm = obj.shadow.map;
      textureVRAM += sm.width * sm.height * 4; // Depth texture
    }
  });

  // Post-processing render targets
  const w = renderer.domElement.clientWidth;
  const h = renderer.domElement.clientHeight;
  const postProcessVRAM = w * h * 8 * 3; // 3 HalfFloat RGBA targets

  return textureVRAM + geometryVRAM + postProcessVRAM;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Detect if running on a mobile device (rough heuristic).
 */
function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Capture and log renderer.info for the current room.
 * Call after a room is fully loaded and one frame has rendered.
 */
export function profileRoom(
  renderer: THREE.WebGLRenderer,
  roomId: number,
  roomName: string,
  scene?: THREE.Scene,
): RoomSnapshot {
  const info = renderer.info;

  // Estimate VRAM — use scene traversal if available, else heuristic
  const estimatedVRAM = scene
    ? estimateVRAMFromScene(scene, renderer)
    : estimateSceneVRAM(renderer);

  const snapshot: RoomSnapshot = {
    roomId,
    roomName,
    drawCalls: info.render.calls,
    triangles: info.render.triangles,
    textures: info.memory.textures,
    geometries: info.memory.geometries,
    estimatedVRAM,
    timestamp: performance.now(),
  };

  const prev = history.length > 0 ? history[history.length - 1]! : null;
  const texDelta = prev ? snapshot.textures - prev.textures : 0;
  const geoDelta = prev ? snapshot.geometries - prev.geometries : 0;

  const warn = snapshot.drawCalls > 60 ? ' OVER BUDGET (draw calls)' : '';
  const budget = isMobile() ? VRAM_BUDGET_MOBILE : VRAM_BUDGET_DESKTOP;
  const vramWarn = estimatedVRAM > budget
    ? ` OVER VRAM BUDGET (${formatBytes(estimatedVRAM)} / ${formatBytes(budget)})`
    : '';

  console.log(
    `[profiler] Room ${roomId} "${roomName}"${warn}${vramWarn}\n` +
    `  draw calls: ${snapshot.drawCalls}, triangles: ${snapshot.triangles}\n` +
    `  textures: ${snapshot.textures} (${texDelta >= 0 ? '+' : ''}${texDelta}), ` +
    `geometries: ${snapshot.geometries} (${geoDelta >= 0 ? '+' : ''}${geoDelta})\n` +
    `  estimated VRAM: ${formatBytes(estimatedVRAM)}`,
  );

  if (texDelta > 20) {
    console.warn(`[profiler] Texture count jumped by ${texDelta} — possible leak`);
  }
  if (geoDelta > 20) {
    console.warn(`[profiler] Geometry count jumped by ${geoDelta} — possible leak`);
  }

  history.push(snapshot);
  return snapshot;
}

/**
 * Log a disposal summary (call after unloading a room).
 */
export function profileDisposal(
  renderer: THREE.WebGLRenderer,
  roomId: number,
  roomName: string,
): void {
  const info = renderer.info;
  const prev = history.length > 0 ? history[history.length - 1]! : null;
  const textures = info.memory.textures;
  const geometries = info.memory.geometries;

  if (prev) {
    const texDelta = textures - prev.textures;
    const geoDelta = geometries - prev.geometries;
    console.log(
      `[profiler] Unloaded Room ${roomId} "${roomName}"\n` +
      `  textures: ${textures} (${texDelta >= 0 ? '+' : ''}${texDelta}), ` +
      `geometries: ${geometries} (${geoDelta >= 0 ? '+' : ''}${geoDelta})`,
    );

    if (texDelta >= 0) {
      console.warn(`[profiler] Textures did not decrease after unload — leak likely`);
    }
  }
}

/**
 * Get the full profiling history (for advanced analysis).
 */
export function getProfilingHistory(): readonly RoomSnapshot[] {
  return history;
}
