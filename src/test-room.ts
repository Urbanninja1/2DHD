import * as THREE from 'three';
import {
  createStoneFloorTexture,
  createStoneWallTexture,
  createNPCSpriteTexture,
} from './rendering/placeholder-textures.js';
import { createSpriteMesh, createBlobShadow } from './rendering/sprite-factory.js';

/**
 * Creates a test room for Phase 1-2 development.
 * Returns a Group containing all room geometry, lights, and NPCs.
 */
export function buildTestRoom(): THREE.Group {
  const room = new THREE.Group();
  room.name = 'room-test';

  const floorTex = createStoneFloorTexture();
  floorTex.wrapS = THREE.RepeatWrapping;
  floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(6, 3);

  const wallTex = createStoneWallTexture();
  wallTex.wrapS = THREE.RepeatWrapping;
  wallTex.wrapT = THREE.RepeatWrapping;
  wallTex.repeat.set(6, 1.5);

  // Floor: 24m x 12m
  const floorGeo = new THREE.PlaneGeometry(24, 12);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    roughness: 0.8,
    metalness: 0.1,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.receiveShadow = true;
  room.add(floor);

  // Walls
  const wallMat = new THREE.MeshStandardMaterial({
    map: wallTex,
    roughness: 0.9,
    metalness: 0.05,
  });
  const wallHeight = 6;

  // Back wall (north, z = -6)
  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(24, wallHeight),
    wallMat,
  );
  backWall.position.set(0, wallHeight / 2, -6);
  backWall.receiveShadow = true;
  room.add(backWall);

  // Front wall (south, z = 6)
  const frontWall = new THREE.Mesh(
    new THREE.PlaneGeometry(24, wallHeight),
    wallMat.clone(),
  );
  frontWall.position.set(0, wallHeight / 2, 6);
  frontWall.rotation.y = Math.PI;
  frontWall.receiveShadow = true;
  room.add(frontWall);

  // Left wall (west, x = -12)
  const leftWallTex = createStoneWallTexture();
  leftWallTex.wrapS = THREE.RepeatWrapping;
  leftWallTex.wrapT = THREE.RepeatWrapping;
  leftWallTex.repeat.set(3, 1.5);
  const leftWall = new THREE.Mesh(
    new THREE.PlaneGeometry(12, wallHeight),
    new THREE.MeshStandardMaterial({ map: leftWallTex, roughness: 0.9, metalness: 0.05 }),
  );
  leftWall.position.set(-12, wallHeight / 2, 0);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.receiveShadow = true;
  room.add(leftWall);

  // Right wall (east, x = 12)
  const rightWallTex = createStoneWallTexture();
  rightWallTex.wrapS = THREE.RepeatWrapping;
  rightWallTex.wrapT = THREE.RepeatWrapping;
  rightWallTex.repeat.set(3, 1.5);
  const rightWall = new THREE.Mesh(
    new THREE.PlaneGeometry(12, wallHeight),
    new THREE.MeshStandardMaterial({ map: rightWallTex, roughness: 0.9, metalness: 0.05 }),
  );
  rightWall.position.set(12, wallHeight / 2, 0);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.receiveShadow = true;
  room.add(rightWall);

  // Ceiling
  const ceilingGeo = new THREE.PlaneGeometry(24, 12);
  ceilingGeo.rotateX(Math.PI / 2);
  const ceilingMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a2a,
    roughness: 0.95,
    metalness: 0,
  });
  const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
  ceiling.position.y = wallHeight;
  room.add(ceiling);

  // --- Lighting ---

  // Ambient light (dark — room should mostly be lit by point lights)
  const ambient = new THREE.AmbientLight(0x4466AA, 0.15);
  room.add(ambient);

  // Directional light (simulating window light from upper right)
  const dirLight = new THREE.DirectionalLight(0xFFE8C0, 0.8);
  dirLight.position.set(8, 12, -4);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 40;
  dirLight.shadow.camera.left = -15;
  dirLight.shadow.camera.right = 15;
  dirLight.shadow.camera.top = 10;
  dirLight.shadow.camera.bottom = -10;
  room.add(dirLight);

  // Torch point lights (will be driven by FlickerLight ECS entities)
  const torch1 = createTorch(-8, 3.5, -5.5);
  room.add(torch1);

  const torch2 = createTorch(8, 3.5, -5.5);
  room.add(torch2);

  // --- Static NPCs ---
  const npcTex1 = createNPCSpriteTexture('#8B0000');
  const npc1 = createSpriteMesh(npcTex1);
  npc1.position.set(-4, 0, -2);
  room.add(npc1);
  room.add(createBlobShadowAt(-4, -2));

  const npcTex2 = createNPCSpriteTexture('#2F1B0E');
  const npc2 = createSpriteMesh(npcTex2);
  npc2.position.set(5, 0, 1);
  room.add(npc2);
  room.add(createBlobShadowAt(5, 1));

  return room;
}

function createTorch(x: number, y: number, z: number): THREE.PointLight {
  const light = new THREE.PointLight(0xFFCC66, 2.0, 15, 1);
  light.position.set(x, y, z);
  // NO shadow on point lights — catastrophic performance
  light.castShadow = false;
  return light;
}

function createBlobShadowAt(x: number, z: number): THREE.Mesh {
  const shadow = createBlobShadow(0.4);
  shadow.position.set(x, 0.01, z);
  return shadow;
}

/**
 * Returns the point lights from the test room for FlickerLight ECS registration.
 */
export function getTestRoomTorches(roomGroup: THREE.Group): THREE.PointLight[] {
  const torches: THREE.PointLight[] = [];
  roomGroup.traverse((child) => {
    if ((child as THREE.PointLight).isLight && child.type === 'PointLight') {
      torches.push(child as THREE.PointLight);
    }
  });
  return torches;
}
