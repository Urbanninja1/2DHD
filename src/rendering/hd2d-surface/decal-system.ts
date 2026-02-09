/**
 * Instanced decal atlas renderer.
 * Creates one InstancedMesh per surface orientation (floor, walls, ceiling)
 * with per-instance atlas UV remapping via aUvRegion attribute.
 *
 * Z-fighting prevention (triple defense):
 *   1. depthWrite: false
 *   2. polygonOffset: true, factor: -4
 *   3. Position offset 0.005 units along surface normal (done by decal-placer)
 */
import * as THREE from 'three';
import type { DecalInstance, SurfaceType, AtlasRegion } from './decal-placer.js';

/** Decal system managing instanced meshes for all surface orientations */
export class DecalSystem {
  private floorMesh: THREE.InstancedMesh | null = null;
  private wallMesh: THREE.InstancedMesh | null = null;
  private ceilingMesh: THREE.InstancedMesh | null = null;

  private floorCount = 0;
  private wallCount = 0;
  private ceilingCount = 0;

  private floorUvRegions: Float32Array;
  private wallUvRegions: Float32Array;
  private ceilingUvRegions: Float32Array;

  private group = new THREE.Group();
  private material: THREE.MeshStandardMaterial;
  private disposed = false;

  constructor(
    atlas: THREE.Texture,
    private maxFloor: number,
    private maxWall: number,
    private maxCeiling: number,
  ) {
    // Shared material for all decal meshes
    this.material = new THREE.MeshStandardMaterial({
      map: atlas,
      transparent: true,
      alphaTest: 0.01,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      roughness: 0.95,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });

    // Inject per-instance UV region remapping
    this.material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
attribute vec4 aUvRegion;
varying vec4 vUvRegion;`,
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
vUvRegion = aUvRegion;`,
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#define STANDARD',
        `#define STANDARD
varying vec4 vUvRegion;`,
      );

      // Replace map_fragment to remap UVs to atlas sub-region
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
    vec2 atlasUV = vUvRegion.xy + vMapUv * vUvRegion.zw;
    vec4 sampledDiffuseColor = texture2D(map, atlasUV);
    #ifdef DECODE_VIDEO_TEXTURE
        sampledDiffuseColor = sRGBTransferEOTF(sampledDiffuseColor);
    #endif
    diffuseColor *= sampledDiffuseColor;
#endif`,
      );
    };
    this.material.customProgramCacheKey = () => 'hd2d-decal-atlas-v1';

    // Pre-allocate UV region buffers
    this.floorUvRegions = new Float32Array(maxFloor * 4);
    this.wallUvRegions = new Float32Array(maxWall * 4);
    this.ceilingUvRegions = new Float32Array(maxCeiling * 4);

    // Create floor mesh (quad lying flat on XZ)
    const floorGeo = new THREE.PlaneGeometry(1, 1);
    floorGeo.rotateX(-Math.PI / 2);
    this.floorMesh = new THREE.InstancedMesh(floorGeo, this.material, maxFloor);
    this.floorMesh.count = 0;
    this.floorMesh.receiveShadow = true;
    this.floorMesh.castShadow = false;
    this.floorMesh.name = 'decals-floor';
    this.floorMesh.frustumCulled = false;

    // Create wall mesh (vertical quad)
    const wallGeo = new THREE.PlaneGeometry(1, 1);
    this.wallMesh = new THREE.InstancedMesh(wallGeo, this.material, maxWall);
    this.wallMesh.count = 0;
    this.wallMesh.receiveShadow = true;
    this.wallMesh.castShadow = false;
    this.wallMesh.name = 'decals-wall';
    this.wallMesh.frustumCulled = false;

    // Create ceiling mesh (quad facing down)
    const ceilingGeo = new THREE.PlaneGeometry(1, 1);
    ceilingGeo.rotateX(Math.PI / 2);
    this.ceilingMesh = new THREE.InstancedMesh(ceilingGeo, this.material, maxCeiling);
    this.ceilingMesh.count = 0;
    this.ceilingMesh.receiveShadow = true;
    this.ceilingMesh.castShadow = false;
    this.ceilingMesh.name = 'decals-ceiling';
    this.ceilingMesh.frustumCulled = false;
  }

  /** Add a decal instance to the appropriate surface mesh */
  addDecal(instance: DecalInstance): void {
    const { position, rotation, scale, atlasRegion, surfaceType } = instance;

    if (surfaceType === 'floor') {
      if (this.floorCount >= this.maxFloor) return;
      this.setInstance(this.floorMesh!, this.floorUvRegions, this.floorCount, position, rotation, scale, atlasRegion);
      this.floorCount++;
    } else if (surfaceType === 'ceiling') {
      if (this.ceilingCount >= this.maxCeiling) return;
      this.setInstance(this.ceilingMesh!, this.ceilingUvRegions, this.ceilingCount, position, rotation, scale, atlasRegion);
      this.ceilingCount++;
    } else {
      // Wall decals — determine rotation based on which wall
      if (this.wallCount >= this.maxWall) return;
      const wallRotation = this.getWallRotation(surfaceType);
      this.setInstance(this.wallMesh!, this.wallUvRegions, this.wallCount, position, wallRotation + rotation, scale, atlasRegion);
      this.wallCount++;
    }
  }

  /** Finalize: attach UV region attributes and add meshes to group */
  finalize(): THREE.Group {
    // Set actual counts and attach UV attributes
    this.floorMesh!.count = this.floorCount;
    this.floorMesh!.geometry.setAttribute('aUvRegion',
      new THREE.InstancedBufferAttribute(this.floorUvRegions, 4));
    this.floorMesh!.instanceMatrix.needsUpdate = true;
    this.group.add(this.floorMesh!);

    this.wallMesh!.count = this.wallCount;
    this.wallMesh!.geometry.setAttribute('aUvRegion',
      new THREE.InstancedBufferAttribute(this.wallUvRegions, 4));
    this.wallMesh!.instanceMatrix.needsUpdate = true;
    this.group.add(this.wallMesh!);

    this.ceilingMesh!.count = this.ceilingCount;
    this.ceilingMesh!.geometry.setAttribute('aUvRegion',
      new THREE.InstancedBufferAttribute(this.ceilingUvRegions, 4));
    this.ceilingMesh!.instanceMatrix.needsUpdate = true;
    this.group.add(this.ceilingMesh!);

    this.group.name = 'decal-system';
    return this.group;
  }

  /** Get the floor InstancedMesh (for quality scaler count reduction) */
  getFloorMesh(): THREE.InstancedMesh | null { return this.floorMesh; }
  /** Get the ceiling InstancedMesh (for quality scaler visibility toggle) */
  getCeilingMesh(): THREE.InstancedMesh | null { return this.ceilingMesh; }
  /** Get the wall InstancedMesh */
  getWallMesh(): THREE.InstancedMesh | null { return this.wallMesh; }

  /** Total floor decal count (before quality scaler reduction) */
  get totalFloorCount(): number { return this.floorCount; }

  /** Dispose all GPU resources */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    for (const mesh of [this.floorMesh, this.wallMesh, this.ceilingMesh]) {
      if (mesh) {
        mesh.geometry.dispose();
        // Material is shared — only dispose once
      }
    }
    this.material.dispose();
  }

  // --- Private helpers ---

  private setInstance(
    mesh: THREE.InstancedMesh,
    uvRegions: Float32Array,
    index: number,
    position: { x: number; y: number; z: number },
    rotation: number,
    scale: number,
    atlasRegion: AtlasRegion,
  ): void {
    const dummy = DecalSystem.dummy;
    dummy.position.set(position.x, position.y, position.z);
    dummy.rotation.set(0, rotation, 0);
    dummy.scale.set(scale, scale, scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);

    // Write UV region (u, v, w, h)
    const i4 = index * 4;
    uvRegions[i4] = atlasRegion.u;
    uvRegions[i4 + 1] = atlasRegion.v;
    uvRegions[i4 + 2] = atlasRegion.w;
    uvRegions[i4 + 3] = atlasRegion.h;
  }

  private getWallRotation(surfaceType: SurfaceType): number {
    switch (surfaceType) {
      case 'wall-n': return 0;
      case 'wall-s': return Math.PI;
      case 'wall-w': return Math.PI / 2;
      case 'wall-e': return -Math.PI / 2;
      default: return 0;
    }
  }

  /** Shared dummy object for matrix computation */
  private static dummy = new THREE.Object3D();
}
