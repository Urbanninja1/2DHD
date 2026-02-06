import * as THREE from 'three';

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
  width = 1.5,
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

  return mesh;
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
