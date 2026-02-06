import * as THREE from 'three';
import type { RoomData, DoorDef } from './room-data/types.js';
import {
  createStoneFloorTexture,
  createStoneWallTexture,
  createNPCSpriteTexture,
} from '../rendering/placeholder-textures.js';
import { createSpriteMesh, createBlobShadow } from '../rendering/sprite-factory.js';
import { createDustMotes, type DustMoteSystem } from '../rendering/particles/dust-motes.js';
import { createTorchEmbers, type EmberSystem } from '../rendering/particles/torch-embers.js';

export type ParticleSystem = DustMoteSystem | EmberSystem;

export interface BuiltRoom {
  /** Root group containing all room objects — scene.remove(group) cleans everything */
  group: THREE.Group;
  /** Point lights that should become FlickerLight ECS entities */
  flickerLights: THREE.PointLight[];
  /** Door trigger AABBs for collision detection */
  doorTriggers: DoorTrigger[];
  /** Room AABB bounds for player collision */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Active particle systems — must be updated each frame and disposed on room unload */
  particleSystems: ParticleSystem[];
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

/**
 * Builds a 3D room scene from RoomData.
 * Returns a dedicated THREE.Group per room — all objects are children of this group.
 */
export function buildRoom(data: RoomData): BuiltRoom {
  const group = new THREE.Group();
  group.name = `room-${data.id}`;

  const { width, depth, height } = data.dimensions;
  const halfW = width / 2;
  const halfD = depth / 2;

  // --- Floor ---
  const floorTex = createStoneFloorTexture();
  floorTex.wrapS = THREE.RepeatWrapping;
  floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(width / 4, depth / 4);

  const floorGeo = new THREE.PlaneGeometry(width, depth);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    color: data.floorColor ?? 0x3a3a3a,
    roughness: 0.8,
    metalness: 0.1,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.receiveShadow = true;
  group.add(floor);

  // --- Walls ---
  const wallTex = createStoneWallTexture();
  wallTex.wrapS = THREE.RepeatWrapping;
  wallTex.wrapT = THREE.RepeatWrapping;

  const wallColor = data.wallColor ?? 0x4a4540;

  // Collect door positions per wall for gap creation
  const doorsByWall = new Map<string, DoorDef[]>();
  for (const door of data.doors) {
    const existing = doorsByWall.get(door.wall) ?? [];
    existing.push(door);
    doorsByWall.set(door.wall, existing);
  }

  // North wall (z = -halfD)
  buildWall(group, width, height, { x: 0, y: height / 2, z: -halfD }, 0, wallTex, wallColor, doorsByWall.get('north'));
  // South wall (z = +halfD)
  buildWall(group, width, height, { x: 0, y: height / 2, z: halfD }, Math.PI, wallTex, wallColor, doorsByWall.get('south'));
  // West wall (x = -halfW)
  buildWall(group, depth, height, { x: -halfW, y: height / 2, z: 0 }, Math.PI / 2, wallTex, wallColor, doorsByWall.get('west'));
  // East wall (x = +halfW)
  buildWall(group, depth, height, { x: halfW, y: height / 2, z: 0 }, -Math.PI / 2, wallTex, wallColor, doorsByWall.get('east'));

  // --- Ceiling ---
  const ceilingGeo = new THREE.PlaneGeometry(width, depth);
  ceilingGeo.rotateX(Math.PI / 2);
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: data.ceilingColor ?? 0x2a2a2a,
    roughness: 0.95,
    metalness: 0,
  });
  const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
  ceiling.position.y = height;
  group.add(ceiling);

  // --- Lighting ---
  // Ambient light
  const ambient = new THREE.AmbientLight(data.ambientLight.color, data.ambientLight.intensity);
  group.add(ambient);

  const flickerLights: THREE.PointLight[] = [];

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
  for (const npcDef of data.npcs) {
    const tex = createNPCSpriteTexture(npcDef.spriteColor);
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
      if (pDef.type === 'dust') {
        const dust = createDustMotes({
          count: pDef.count,
          region: pDef.region,
        });
        group.add(dust.points);
        particleSystems.push(dust);
      } else if (pDef.type === 'embers') {
        const embers = createTorchEmbers({
          position: pDef.position,
          count: pDef.count,
        });
        group.add(embers.points);
        particleSystems.push(embers);
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

  return { group, flickerLights, doorTriggers, bounds, particleSystems };
}

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
  // (actual geometry gaps would require custom geometry per wall config)
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

  // Add dark door openings as visual indicators
  if (doors) {
    for (const door of doors) {
      const doorGeo = new THREE.PlaneGeometry(3, 4);
      const doorMat = new THREE.MeshBasicMaterial({
        color: 0x050505,
        side: THREE.DoubleSide,
      });
      const doorMesh = new THREE.Mesh(doorGeo, doorMat);

      // Position the door opening on the wall
      // The door position is in room coords; we need to place it relative to wall
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
}

/**
 * Disposes all GPU resources owned by a room group.
 */
export function disposeRoom(group: THREE.Group): void {
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
        mat.dispose();
      }
    }
  });
}
