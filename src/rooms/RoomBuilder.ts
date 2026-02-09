import * as THREE from 'three';
import type { RoomData, DoorDef, PropDef, ProceduralPropDef, ModelPropDef, TextureSetDef, ParallaxLayerDef, ParticleDef } from './room-data/types.js';
import {
  createStoneFloorTexture,
  createStoneWallTexture,
  createNPCSpriteTexture,
  releaseStoneFloorTexture,
  releaseStoneWallTexture,
  releaseNPCSpriteTexture,
} from '../rendering/placeholder-textures.js';
import { createSpriteMesh, createBlobShadow } from '../rendering/sprite-factory.js';
import { SpriteAnimator, registerAnimator } from '../rendering/sprite-animator.js';
import { createDustMotes } from '../rendering/particles/dust-motes.js';
import { createTorchEmbers } from '../rendering/particles/torch-embers.js';
import { createSmoke } from '../rendering/particles/smoke.js';
import { createDustInLight } from '../rendering/particles/dust-in-light.js';
import type { ParticleSystem } from '../rendering/particles/types.js';
import { assetManager } from '../loaders/asset-manager.js';
import { loadPBRTexture, textureLoader, type PBRTextureSet, type LoaderSet } from '../loaders/texture-loaders.js';

export interface BuiltRoom {
  /** Root group containing all room objects — scene.remove(group) cleans everything */
  group: THREE.Group;
  /** Point lights that should become FlickerLight ECS entities */
  flickerLights: THREE.PointLight[];
  /** First shadow-casting directional light — used for god rays */
  directionalLight: THREE.DirectionalLight | null;
  /** Door trigger AABBs for collision detection */
  doorTriggers: DoorTrigger[];
  /** Room AABB bounds for player collision */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Active particle systems — must be updated each frame and disposed on room unload */
  particleSystems: ParticleSystem[];
  /** Parallax layer meshes — UVs scrolled based on camera X each frame */
  parallaxLayers: THREE.Mesh[];
  /** Active sprite animators — unregister on room unload */
  spriteAnimators: SpriteAnimator[];
}

export interface DoorTrigger {
  /** AABB min/max for door trigger zone */
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** The door definition (target room, spawn point, etc.) */
  door: DoorDef;
}

/** Create a particle system from a ParticleDef. */
function createParticleSystem(def: ParticleDef): ParticleSystem {
  switch (def.type) {
    case 'dust':
      return createDustMotes({ count: def.count, region: def.region, driftDirection: def.driftDirection });
    case 'embers':
      return createTorchEmbers({ position: def.position, count: def.count });
    case 'smoke':
      return createSmoke({ position: def.position, count: def.count, spread: def.spread });
    case 'dust-in-light':
      return createDustInLight({ region: def.region, count: def.count, lightDirection: def.lightDirection });
    default: {
      const _exhaustive: never = def;
      throw new Error(`Unknown particle type: ${(_exhaustive as ParticleDef).type}`);
    }
  }
}

/**
 * Builds a 3D room scene from RoomData.
 * Returns a dedicated THREE.Group per room — all objects are children of this group.
 * Now async to support loading PBR textures, GLTF models, and sprite images.
 */
export async function buildRoom(data: RoomData, loaderSet?: LoaderSet): Promise<BuiltRoom> {
  const group = new THREE.Group();
  group.name = `room-${data.id}`;

  const { width, depth, height } = data.dimensions;
  const halfW = width / 2;
  const halfD = depth / 2;

  // --- Floor ---
  const floorMat = data.floorTexture
    ? await buildPBRMaterial(data.floorTexture, `floor-${data.id}`, width / 4, depth / 4, data.floorColor)
    : buildProceduralFloorMaterial(data, width, depth);

  const floorGeo = new THREE.PlaneGeometry(width, depth);
  floorGeo.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.receiveShadow = true;
  group.add(floor);

  // --- Walls ---
  const wallColor = data.wallColor ?? 0x4a4540;

  // Collect door positions per wall for gap creation
  const doorsByWall = new Map<string, DoorDef[]>();
  for (const door of data.doors) {
    const existing = doorsByWall.get(door.wall) ?? [];
    existing.push(door);
    doorsByWall.set(door.wall, existing);
  }

  if (data.wallTexture) {
    const wallPBR = await loadPBRTextureSet(data.wallTexture, `wall-${data.id}`);
    buildWallPBR(group, width, height, { x: 0, y: height / 2, z: -halfD }, 0, wallPBR, wallColor, width, height, doorsByWall.get('north'));
    buildWallPBR(group, width, height, { x: 0, y: height / 2, z: halfD }, Math.PI, wallPBR, wallColor, width, height, doorsByWall.get('south'));
    buildWallPBR(group, depth, height, { x: -halfW, y: height / 2, z: 0 }, Math.PI / 2, wallPBR, wallColor, depth, height, doorsByWall.get('west'));
    buildWallPBR(group, depth, height, { x: halfW, y: height / 2, z: 0 }, -Math.PI / 2, wallPBR, wallColor, depth, height, doorsByWall.get('east'));
  } else {
    const wallTex = createStoneWallTexture();
    wallTex.wrapS = THREE.RepeatWrapping;
    wallTex.wrapT = THREE.RepeatWrapping;

    buildWall(group, width, height, { x: 0, y: height / 2, z: -halfD }, 0, wallTex, wallColor, doorsByWall.get('north'));
    buildWall(group, width, height, { x: 0, y: height / 2, z: halfD }, Math.PI, wallTex, wallColor, doorsByWall.get('south'));
    buildWall(group, depth, height, { x: -halfW, y: height / 2, z: 0 }, Math.PI / 2, wallTex, wallColor, doorsByWall.get('west'));
    buildWall(group, depth, height, { x: halfW, y: height / 2, z: 0 }, -Math.PI / 2, wallTex, wallColor, doorsByWall.get('east'));
  }

  // --- Ceiling ---
  const ceilingGeo = new THREE.PlaneGeometry(width, depth);
  ceilingGeo.rotateX(Math.PI / 2);
  let ceilingMat: THREE.MeshStandardMaterial;
  if (data.ceilingTexture) {
    ceilingMat = await buildPBRMaterial(data.ceilingTexture, `ceiling-${data.id}`, width / 4, depth / 4, data.ceilingColor);
  } else {
    ceilingMat = new THREE.MeshStandardMaterial({
      color: data.ceilingColor ?? 0x2a2a2a,
      roughness: 0.95,
      metalness: 0,
    });
  }
  const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
  ceiling.position.y = height;
  group.add(ceiling);

  // --- Lighting ---
  const ambient = new THREE.AmbientLight(data.ambientLight.color, data.ambientLight.intensity);
  group.add(ambient);

  const flickerLights: THREE.PointLight[] = [];
  let directionalLight: THREE.DirectionalLight | null = null;

  for (const lightDef of data.lights) {
    if (lightDef.type === 'directional') {
      const dirLight = new THREE.DirectionalLight(lightDef.color, lightDef.intensity);
      dirLight.position.set(lightDef.position.x, lightDef.position.y, lightDef.position.z);
      if (lightDef.castShadow) {
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.set(2048, 2048);
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 50;
        dirLight.shadow.camera.left = -halfW;
        dirLight.shadow.camera.right = halfW;
        dirLight.shadow.camera.top = halfD;
        dirLight.shadow.camera.bottom = -halfD;
      }
      if (!directionalLight) directionalLight = dirLight;
      group.add(dirLight);
    } else if (lightDef.type === 'point') {
      const pointLight = new THREE.PointLight(
        lightDef.color,
        lightDef.intensity,
        lightDef.distance ?? 15,
        lightDef.decay ?? 1,
      );
      pointLight.position.set(lightDef.position.x, lightDef.position.y, lightDef.position.z);
      pointLight.castShadow = false; // NEVER on point lights — perf catastrophe
      group.add(pointLight);

      if (lightDef.flicker) {
        flickerLights.push(pointLight);
      }
    }
  }

  // --- Door trigger visuals (subtle floor markers) ---
  for (const door of data.doors) {
    const markerGeo = new THREE.PlaneGeometry(
      door.halfExtents.x * 2,
      door.halfExtents.z * 2,
    );
    markerGeo.rotateX(-Math.PI / 2);
    const markerMat = new THREE.MeshBasicMaterial({
      color: 0xAAAA00,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    });
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.position.set(door.position.x, 0.02, door.position.z);
    marker.renderOrder = -1;
    group.add(marker);
  }

  // --- NPCs (plain Three.js sprites, not ECS) ---
  const spriteAnimators: SpriteAnimator[] = [];

  for (const npcDef of data.npcs) {
    let tex: THREE.Texture;
    let hasSpritesheet = false;
    if (npcDef.spritePath) {
      try {
        tex = await textureLoader.loadAsync(npcDef.spritePath);
        tex.minFilter = THREE.NearestFilter;
        tex.magFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        tex.colorSpace = THREE.SRGBColorSpace;
        hasSpritesheet = true;
      } catch {
        // Fall back to procedural if file not found
        tex = createNPCSpriteTexture(npcDef.spriteColor);
      }
    } else {
      tex = createNPCSpriteTexture(npcDef.spriteColor);
    }

    // Wire spritesheet animation (4 cols, 2 rows: idle + walk)
    if (hasSpritesheet) {
      const animator = new SpriteAnimator(tex, 4, 2, 4);
      animator.play(0); // idle row
      registerAnimator(animator);
      spriteAnimators.push(animator);
    }

    const sprite = createSpriteMesh(tex);
    sprite.position.set(npcDef.position.x, npcDef.position.y, npcDef.position.z);
    sprite.name = `npc-${npcDef.label}`;
    group.add(sprite);

    const shadow = createBlobShadow(0.4);
    shadow.position.set(npcDef.position.x, 0.01, npcDef.position.z);
    group.add(shadow);
  }

  // --- Build door triggers ---
  const doorTriggers: DoorTrigger[] = data.doors.map(door => ({
    minX: door.position.x - door.halfExtents.x,
    maxX: door.position.x + door.halfExtents.x,
    minZ: door.position.z - door.halfExtents.z,
    maxZ: door.position.z + door.halfExtents.z,
    door,
  }));

  // --- Particle systems ---
  const particleSystems: ParticleSystem[] = [];

  if (data.particles) {
    for (const pDef of data.particles) {
      const system = createParticleSystem(pDef);
      group.add(system.object3d);
      particleSystems.push(system);
    }
  }

  // --- Instanced props (columns, sconces, models) ---
  // Load all model props in parallel (P0 perf fix — prevents sequential N-fetch stall)
  if (data.props) {
    const modelDefs = data.props.filter((p): p is ModelPropDef => p.type === 'model');
    const proceduralDefs = data.props.filter((p): p is ProceduralPropDef => p.type !== 'model');

    // Procedural props are synchronous — build immediately
    for (const propDef of proceduralDefs) {
      const mesh = buildInstancedProp(propDef, height);
      if (mesh) group.add(mesh);
    }

    // Model props — load all in parallel
    const modelResults = await Promise.all(
      modelDefs.map(propDef => buildModelProp(propDef, loaderSet)),
    );
    for (const mesh of modelResults) {
      if (mesh) group.add(mesh);
    }
  }

  // --- Parallax background layers ---
  const parallaxLayers: THREE.Mesh[] = [];
  if (data.parallaxBackground) {
    for (const layerDef of data.parallaxBackground) {
      const mesh = await buildParallaxLayer(layerDef, width, halfD);
      if (mesh) {
        group.add(mesh);
        parallaxLayers.push(mesh);
      }
    }
  }

  // Room collision bounds (player can't go beyond walls, with a small margin)
  const margin = 0.5;
  const bounds = {
    minX: -halfW + margin,
    maxX: halfW - margin,
    minZ: -halfD + margin,
    maxZ: halfD - margin,
  };

  return { group, flickerLights, directionalLight, doorTriggers, bounds, particleSystems, parallaxLayers, spriteAnimators };
}

// --- PBR Material Helpers ---

async function loadPBRTextureSet(def: TextureSetDef, cacheKey: string): Promise<PBRTextureSet> {
  return assetManager.loadPBRSetAsync(`pbr-${cacheKey}`, () =>
    loadPBRTexture(def.basePath, cacheKey),
  );
}

async function buildPBRMaterial(
  def: TextureSetDef,
  cacheKey: string,
  repeatX: number,
  repeatY: number,
  tintColor?: number,
): Promise<THREE.MeshStandardMaterial> {
  const pbrSet = await loadPBRTexture(def.basePath, cacheKey);

  // Apply repeat/wrap to all maps
  const configureMap = (tex: THREE.Texture, rx: number, ry: number) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(def.repeat?.x ?? rx, def.repeat?.y ?? ry);
  };

  configureMap(pbrSet.diffuse, repeatX, repeatY);
  if (pbrSet.normal) configureMap(pbrSet.normal, repeatX, repeatY);
  if (pbrSet.roughness) configureMap(pbrSet.roughness, repeatX, repeatY);
  if (pbrSet.ao) configureMap(pbrSet.ao, repeatX, repeatY);

  return new THREE.MeshStandardMaterial({
    map: pbrSet.diffuse,
    normalMap: pbrSet.normal ?? undefined,
    roughnessMap: pbrSet.roughness ?? undefined,
    aoMap: pbrSet.ao ?? undefined,
    color: def.tint ?? tintColor ?? 0xffffff,
    roughness: pbrSet.roughness ? 1.0 : 0.8,
    metalness: 0.1,
  });
}

function buildProceduralFloorMaterial(data: RoomData, width: number, depth: number): THREE.MeshStandardMaterial {
  const floorTex = createStoneFloorTexture();
  floorTex.wrapS = THREE.RepeatWrapping;
  floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(width / 4, depth / 4);

  return new THREE.MeshStandardMaterial({
    map: floorTex,
    color: data.floorColor ?? 0x3a3a3a,
    roughness: 0.8,
    metalness: 0.1,
  });
}

// --- Model Prop Loading ---

async function buildModelProp(propDef: ModelPropDef, loaderSet?: LoaderSet): Promise<THREE.InstancedMesh | THREE.Group | null> {
  const { modelPath, positions, scale = 1.0, rotationY = 0 } = propDef;
  if (positions.length === 0) return null;

  try {
    // Use the shared GLTF loader (with DRACO/KTX2 support) if available, else create a bare one
    let gltfLoader: import('three/addons/loaders/GLTFLoader.js').GLTFLoader;
    if (loaderSet) {
      gltfLoader = loaderSet.gltfLoader;
    } else {
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      gltfLoader = new GLTFLoader();
    }

    const modelGroup = await assetManager.loadModelAsync(modelPath, async () => {
      const gltf = await gltfLoader.loadAsync(modelPath);
      return gltf.scene;
    });

    // Collect all meshes from the model
    const sourceMeshes: THREE.Mesh[] = [];
    modelGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        sourceMeshes.push(obj);
      }
    });

    if (sourceMeshes.length === 0) return null;

    const modelName = modelPath.split('/').pop()?.replace('.glb', '') ?? 'unknown';

    // Single instance: clone the entire scene group (preserves multi-mesh hierarchy)
    if (positions.length === 1) {
      const p = positions[0]!;
      const clone = modelGroup.clone();
      clone.position.set(p.x, p.y, p.z);
      clone.rotation.y = ('rotationY' in p && p.rotationY != null) ? p.rotationY : rotationY;
      clone.scale.setScalar(scale);
      clone.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });
      clone.name = `model-${modelName}`;
      return clone;
    }

    // Multiple instances: create InstancedMesh per sub-mesh, grouped together
    const container = new THREE.Group();
    container.name = `model-${modelName}`;
    const dummy = new THREE.Object3D();

    for (const src of sourceMeshes) {
      const instanced = new THREE.InstancedMesh(
        src.geometry,
        src.material,
        positions.length,
      );

      for (let i = 0; i < positions.length; i++) {
        const p = positions[i]!;
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.y = ('rotationY' in p && p.rotationY != null) ? p.rotationY : rotationY;
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        instanced.setMatrixAt(i, dummy.matrix);
      }

      instanced.instanceMatrix.needsUpdate = true;
      instanced.castShadow = true;
      instanced.receiveShadow = true;
      container.add(instanced);
    }

    return container;
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn(`[RoomBuilder] Failed to load model "${modelPath}", skipping:`, e);
    }
    return null;
  }
}

// --- Parallax Background ---

async function buildParallaxLayer(
  layerDef: ParallaxLayerDef,
  roomWidth: number,
  halfDepth: number,
): Promise<THREE.Mesh | null> {
  try {
    const tex = await textureLoader.loadAsync(layerDef.texturePath);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;

    const geo = new THREE.PlaneGeometry(roomWidth * 2, layerDef.height);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, layerDef.yOffset, -halfDepth - layerDef.depth);
    mesh.renderOrder = -10 + layerDef.depth; // Further layers render first
    mesh.name = `parallax-${layerDef.depth}`;
    mesh.userData.scrollFactor = layerDef.scrollFactor;

    return mesh;
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn(`[RoomBuilder] Failed to load parallax layer "${layerDef.texturePath}":`, e);
    }
    return null;
  }
}

// --- Procedural Props ---

/** Shared geometry for prop types — prevents recreating per room */
const propGeoCache = new Map<string, THREE.BufferGeometry>();

function getColumnGeometry(roomHeight: number): THREE.BufferGeometry {
  const key = `column-${roomHeight}`;
  let geo = propGeoCache.get(key);
  if (!geo) {
    // Octagonal column: cylinder with 8 sides
    geo = new THREE.CylinderGeometry(0.4, 0.5, roomHeight, 8);
    geo.translate(0, roomHeight / 2, 0); // Origin at base
    geo.userData.shared = true;
    propGeoCache.set(key, geo);
  }
  return geo;
}

function getSconceGeometry(): THREE.BufferGeometry {
  const key = 'sconce';
  let geo = propGeoCache.get(key);
  if (!geo) {
    // Small bracket sconce: cube base + cone bracket
    geo = new THREE.BoxGeometry(0.2, 0.3, 0.15);
    geo.userData.shared = true;
    propGeoCache.set(key, geo);
  }
  return geo;
}

const COLUMN_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x5a554f,
  roughness: 0.85,
  metalness: 0.05,
});

const SCONCE_MATERIAL = new THREE.MeshStandardMaterial({
  color: 0x4a3a2a,
  roughness: 0.6,
  metalness: 0.3,
});

function buildInstancedProp(propDef: ProceduralPropDef, roomHeight: number): THREE.InstancedMesh | null {
  const { type, positions } = propDef;
  if (positions.length === 0) return null;

  let geometry: THREE.BufferGeometry;
  let material: THREE.Material;

  if (type === 'column') {
    geometry = getColumnGeometry(roomHeight);
    material = COLUMN_MATERIAL;
  } else if (type === 'sconce') {
    geometry = getSconceGeometry();
    material = SCONCE_MATERIAL;
  } else {
    return null;
  }

  const mesh = new THREE.InstancedMesh(geometry, material, positions.length);
  const dummy = new THREE.Object3D();

  for (let i = 0; i < positions.length; i++) {
    const p = positions[i]!;
    dummy.position.set(p.x, p.y, p.z);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }

  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = type === 'column'; // Columns cast shadows, sconces don't
  mesh.receiveShadow = true;
  mesh.name = `instanced-${type}`;

  return mesh;
}

// --- Wall Building ---

function buildWall(
  parent: THREE.Group,
  wallWidth: number,
  wallHeight: number,
  position: { x: number; y: number; z: number },
  rotationY: number,
  texture: THREE.CanvasTexture,
  color: number,
  doors?: DoorDef[],
): void {
  // For walls with doors, we create the full wall with a darker opening
  const tex = texture.clone();
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(wallWidth / 4, wallHeight / 4);

  const wallGeo = new THREE.PlaneGeometry(wallWidth, wallHeight);
  const wallMat = new THREE.MeshStandardMaterial({
    map: tex,
    color,
    roughness: 0.9,
    metalness: 0.05,
  });
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.position.set(position.x, position.y, position.z);
  wall.rotation.y = rotationY;
  wall.receiveShadow = true;
  parent.add(wall);

  addDoorOpenings(parent, position, rotationY, doors);
}

function buildWallPBR(
  parent: THREE.Group,
  wallWidth: number,
  wallHeight: number,
  position: { x: number; y: number; z: number },
  rotationY: number,
  pbrSet: PBRTextureSet,
  color: number,
  repeatW: number,
  repeatH: number,
  doors?: DoorDef[],
): void {
  const configureMap = (tex: THREE.Texture) => {
    const cloned = tex.clone();
    cloned.wrapS = THREE.RepeatWrapping;
    cloned.wrapT = THREE.RepeatWrapping;
    cloned.repeat.set(repeatW / 4, repeatH / 4);
    return cloned;
  };

  const wallGeo = new THREE.PlaneGeometry(wallWidth, wallHeight);
  const wallMat = new THREE.MeshStandardMaterial({
    map: configureMap(pbrSet.diffuse),
    normalMap: pbrSet.normal ? configureMap(pbrSet.normal) : undefined,
    roughnessMap: pbrSet.roughness ? configureMap(pbrSet.roughness) : undefined,
    aoMap: pbrSet.ao ? configureMap(pbrSet.ao) : undefined,
    color,
    roughness: pbrSet.roughness ? 1.0 : 0.9,
    metalness: 0.05,
  });
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.position.set(position.x, position.y, position.z);
  wall.rotation.y = rotationY;
  wall.receiveShadow = true;
  parent.add(wall);

  addDoorOpenings(parent, position, rotationY, doors);
}

function addDoorOpenings(
  parent: THREE.Group,
  position: { x: number; y: number; z: number },
  rotationY: number,
  doors?: DoorDef[],
): void {
  if (!doors) return;

  for (const door of doors) {
    const doorGeo = new THREE.PlaneGeometry(3, 4);
    const doorMat = new THREE.MeshBasicMaterial({
      color: 0x050505,
      side: THREE.DoubleSide,
    });
    const doorMesh = new THREE.Mesh(doorGeo, doorMat);

    if (door.wall === 'north' || door.wall === 'south') {
      doorMesh.position.set(door.position.x, 2, position.z + (door.wall === 'north' ? 0.01 : -0.01));
      doorMesh.rotation.y = rotationY;
    } else {
      doorMesh.position.set(position.x + (door.wall === 'west' ? 0.01 : -0.01), 2, door.position.z);
      doorMesh.rotation.y = rotationY;
    }
    parent.add(doorMesh);
  }
}

/**
 * Disposes all GPU resources owned by a room group.
 * Also releases AssetManager references for shared textures.
 *
 * @param roomData - If provided, releases PBR texture/model refs via AssetManager.
 *                   Falls back to procedural release if not provided.
 */
export function disposeRoom(group: THREE.Group, roomData?: RoomData, npcColors?: string[]): void {
  group.traverse((obj) => {
    // Handle both Mesh and Points (particles)
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
      // Don't dispose shared geometries from sprite cache
      if (!obj.geometry.userData.shared) {
        obj.geometry.dispose();
      }
      const mat = obj.material;
      if (mat instanceof THREE.Material) {
        if ('map' in mat && mat.map) {
          (mat.map as THREE.Texture).dispose();
        }
        if ('normalMap' in mat && (mat as THREE.MeshStandardMaterial).normalMap) {
          (mat as THREE.MeshStandardMaterial).normalMap!.dispose();
        }
        if ('roughnessMap' in mat && (mat as THREE.MeshStandardMaterial).roughnessMap) {
          (mat as THREE.MeshStandardMaterial).roughnessMap!.dispose();
        }
        if ('aoMap' in mat && (mat as THREE.MeshStandardMaterial).aoMap) {
          (mat as THREE.MeshStandardMaterial).aoMap!.dispose();
        }
        mat.dispose();
      }
    }
    // Dispose lights (free shadow maps)
    if (obj instanceof THREE.DirectionalLight && obj.shadow.map) {
      obj.shadow.map.dispose();
    }
  });

  if (roomData) {
    // Release PBR texture set refs (cached as full sets)
    if (roomData.floorTexture) {
      assetManager.releasePBRSet(`pbr-floor-${roomData.id}`);
    } else {
      releaseStoneFloorTexture();
    }

    if (roomData.wallTexture) {
      assetManager.releasePBRSet(`pbr-wall-${roomData.id}`);
    } else {
      // Procedural: 4 walls each created a clone via createStoneWallTexture→AssetManager
      releaseStoneWallTexture();
      releaseStoneWallTexture();
      releaseStoneWallTexture();
      releaseStoneWallTexture();
    }

    if (roomData.ceilingTexture) {
      assetManager.releasePBRSet(`pbr-ceiling-${roomData.id}`);
    }

    // Release model refs
    if (roomData.props) {
      for (const propDef of roomData.props) {
        if (propDef.type === 'model') {
          assetManager.releaseModel((propDef as ModelPropDef).modelPath);
        }
      }
    }

    // Release NPC sprite texture refs
    for (const npc of roomData.npcs) {
      if (npc.spritePath) {
        assetManager.releaseTexture(`sprite-${npc.spritePath}`);
      } else {
        releaseNPCSpriteTexture(npc.spriteColor);
      }
    }
  } else {
    // Legacy fallback: release procedural textures
    releaseStoneFloorTexture();
    releaseStoneWallTexture();
    releaseStoneWallTexture();
    releaseStoneWallTexture();
    releaseStoneWallTexture();

    if (npcColors) {
      for (const color of npcColors) {
        releaseNPCSpriteTexture(color);
      }
    }
  }
}
