import * as THREE from 'three';

/** Registry of billboard sprite meshes — updated once per frame */
const billboardSprites = new Set<THREE.Mesh>();

/** Shared geometry cache keyed by "widthxheight" — prevents duplicate VBOs */
const spriteGeoCache = new Map<string, THREE.PlaneGeometry>();

function getSharedSpriteGeometry(width: number, height: number): THREE.PlaneGeometry {
  const key = `${width}x${height}`;
  let geo = spriteGeoCache.get(key);
  if (!geo) {
    geo = new THREE.PlaneGeometry(width, height);
    geo.translate(0, height / 2, 0);
    geo.userData.shared = true; // Prevents disposeRoom() from disposing shared geometry
    spriteGeoCache.set(key, geo);
  }
  return geo;
}

/**
 * Creates pixel-art billboard sprites using PlaneGeometry (NOT THREE.Sprite).
 * THREE.Sprite auto-rotates on all axes which looks wrong at 3/4 angle.
 */
export function createSpriteMesh(
  texture: THREE.Texture,
  width = 1.0,
  height = 1.5,
): THREE.Mesh {
  // NearestFilter is CRITICAL for pixel art
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;

  const geometry = getSharedSpriteGeometry(width, height);

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    alphaTest: 0.5,
    transparent: false,
    depthWrite: true,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 1; // Render after opaque geometry

  // Auto-register for billboard rotation
  billboardSprites.add(mesh);

  return mesh;
}

/**
 * Remove a sprite from the billboard registry (call on dispose).
 */
export function unregisterBillboard(mesh: THREE.Mesh): void {
  billboardSprites.delete(mesh);
}

/**
 * Update all registered billboard sprites to face the camera (Y-axis only).
 * Call once per frame from the game loop.
 */
export function updateBillboards(camera: THREE.Camera): void {
  for (const sprite of billboardSprites) {
    // Only rotate if the sprite is still in a scene (not disposed)
    if (!sprite.parent) {
      billboardSprites.delete(sprite);
      continue;
    }
    sprite.rotation.y = Math.atan2(
      camera.position.x - sprite.position.x,
      camera.position.z - sprite.position.z,
    );
  }
}

/**
 * Creates a blob shadow — small dark ellipse at sprite's feet.
 * Cheap fake shadow without any shadow map cost.
 */
export function createBlobShadow(radius = 0.5): THREE.Mesh {
  const geometry = new THREE.CircleGeometry(radius, 16);
  geometry.rotateX(-Math.PI / 2); // Lay flat on ground

  const material = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = 0.01; // Slightly above floor to prevent z-fighting
  mesh.renderOrder = 0;

  return mesh;
}
