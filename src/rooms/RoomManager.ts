import * as THREE from 'three';
import type { RoomIdValue } from '../ecs/components/singletons.js';
import { TransitionState, type TransitionStateValue } from '../ecs/components/singletons.js';
import { getRoomData, hasRoomData } from './room-data/registry.js';
import type { RoomData } from './room-data/types.js';
import { buildRoom, disposeRoom, type BuiltRoom, type DoorTrigger } from './RoomBuilder.js';
import type { ParticleSystem } from '../rendering/particles/types.js';
import { unregisterAnimator } from '../rendering/sprite-animator.js';
import { CollisionSystem } from '../ecs/systems/collision.js';
import { updatePipelineSettings, setGodraysLight, removeGodrays, type HD2DPipeline } from '../rendering/hd2d-pipeline.js';
import { profileRoom, profileDisposal } from '../debug/room-profiler.js';
import type { LoaderSet } from '../loaders/texture-loaders.js';

const FADE_OUT_MS = 800;
const HOLD_BLACK_MS = 200;
const FADE_IN_MS = 800;

export interface RoomManagerDeps {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  pipeline: HD2DPipeline;
  loaderSet: LoaderSet;
}

/**
 * Manages room loading/unloading with a transition state machine.
 * Fade overlay is a CSS div (cheaper than WebGL overlay).
 *
 * Exposes state properties that RoomTransitionSystem reads each frame
 * and syncs into the ECS GameState singleton.
 */
export class RoomManager {
  private deps: RoomManagerDeps;
  private currentRoom: BuiltRoom | null = null;
  private currentRoomData: RoomData | null = null;
  private transitioning = false;
  private fadeOverlay: HTMLDivElement;
  private abortController: AbortController | null = null;

  /** Current door triggers — read by RoomTransitionSystem */
  doorTriggers: DoorTrigger[] = [];

  /** Exposed state — synced to ECS GameState by RoomTransitionSystem each frame */
  currentRoomId: RoomIdValue = 1 as RoomIdValue;
  transitionState: TransitionStateValue = TransitionState.IDLE;
  teleported = false;

  /** Pending player spawn — consumed by RoomTransitionSystem */
  pendingSpawn: { x: number; y: number; z: number } | null = null;

  /** Pending flicker lights — consumed by RoomTransitionSystem to create ECS entities */
  pendingFlickerLights: THREE.PointLight[] = [];

  /** Signal to RoomTransitionSystem to destroy existing FlickerLight entities before creating new ones */
  pendingFlickerCleanup = false;

  /** Active particle systems for the current room — updated each frame */
  private activeParticles: ParticleSystem[] = [];

  /** Parallax layer meshes for the current room — UV-scrolled each frame */
  private parallaxLayers: THREE.Mesh[] = [];

  /** NPC colors from current room — needed for AssetManager release on unload (legacy) */
  private currentNpcColors: string[] = [];

  constructor(deps: RoomManagerDeps) {
    this.deps = deps;

    // Create fade overlay
    this.fadeOverlay = document.createElement('div');
    this.fadeOverlay.id = 'room-fade-overlay';
    Object.assign(this.fadeOverlay.style, {
      position: 'fixed',
      inset: '0',
      background: '#000',
      opacity: '0',
      pointerEvents: 'none',
      zIndex: '50',
      transition: 'none',
    });
    document.body.appendChild(this.fadeOverlay);
  }

  get isTransitioning(): boolean {
    return this.transitioning;
  }

  /**
   * Load a room immediately (no transition animation). Used for initial room load.
   */
  async loadRoom(roomId: RoomIdValue): Promise<void> {
    if (!hasRoomData(roomId)) {
      console.warn(`[RoomManager] No room data for room ${roomId}`);
      return;
    }

    // Unload current room if any
    if (this.currentRoom) {
      this.unloadCurrentRoom();
    }

    const data = getRoomData(roomId)!;
    const built = await buildRoom(data, this.deps.loaderSet);

    // Add room to scene
    this.deps.scene.add(built.group);
    this.currentRoom = built;
    this.currentRoomData = data;
    this.currentRoomId = roomId;
    this.doorTriggers = built.doorTriggers;

    // Update collision bounds
    CollisionSystem.roomBounds = built.bounds;

    // Apply per-room post-processing overrides
    if (data.postProcessOverrides) {
      updatePipelineSettings(this.deps.pipeline, data.postProcessOverrides);
    }

    // Set up god rays if room has them and a directional light
    if (data.godRays && built.directionalLight) {
      setGodraysLight(this.deps.pipeline, built.directionalLight, this.deps.camera, {
        color: new THREE.Color(data.godRays.color ?? 0xffffff),
        density: data.godRays.density ?? 1 / 128,
        maxDensity: data.godRays.maxDensity ?? 0.5,
      });
    } else {
      removeGodrays(this.deps.pipeline);
    }

    // Queue flicker lights for ECS entity creation (consumed by RoomTransitionSystem)
    this.pendingFlickerLights = built.flickerLights;

    // Store particle systems for per-frame updates
    this.activeParticles = built.particleSystems;

    // Store parallax layers for per-frame UV scroll
    this.parallaxLayers = built.parallaxLayers;

    // Track NPC colors for AssetManager release on unload (legacy fallback)
    this.currentNpcColors = data.npcs.map(n => n.spriteColor);

    // Force shadow map update for static scene
    this.deps.renderer.shadowMap.needsUpdate = true;

    // Profile room after load
    profileRoom(this.deps.renderer, roomId, data.name);

    // Update exposed state
    this.transitionState = TransitionState.IDLE;
    this.teleported = false;
  }

  /**
   * Transition to a new room with fade-to-black animation.
   */
  async transitionTo(roomId: RoomIdValue, spawnX: number, spawnY: number, spawnZ: number): Promise<void> {
    if (this.transitioning) return;
    if (!hasRoomData(roomId)) {
      console.warn(`[RoomManager] No room data for room ${roomId}, skipping transition`);
      return;
    }

    this.transitioning = true;
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    try {
      // --- FADING_OUT ---
      this.transitionState = TransitionState.FADING_OUT;
      await this.fade(1, FADE_OUT_MS, signal);

      if (signal.aborted) return;

      // --- UNLOADING ---
      this.transitionState = TransitionState.UNLOADING;
      this.unloadCurrentRoom();

      // --- LOADING ---
      this.transitionState = TransitionState.LOADING;
      this.currentRoomId = roomId;

      const data = getRoomData(roomId)!;
      const built = await buildRoom(data, this.deps.loaderSet);

      this.deps.scene.add(built.group);
      this.currentRoom = built;
      this.currentRoomData = data;
      this.doorTriggers = built.doorTriggers;

      // Update collision bounds
      CollisionSystem.roomBounds = built.bounds;

      // Apply per-room post-processing
      if (data.postProcessOverrides) {
        updatePipelineSettings(this.deps.pipeline, data.postProcessOverrides);
      }

      // Set up god rays if room has them and a directional light
      if (data.godRays && built.directionalLight) {
        setGodraysLight(this.deps.pipeline, built.directionalLight, this.deps.camera, {
          color: new THREE.Color(data.godRays.color ?? 0xffffff),
          density: data.godRays.density ?? 1 / 128,
          maxDensity: data.godRays.maxDensity ?? 0.5,
        });
      } else {
        removeGodrays(this.deps.pipeline);
      }

      // Queue flicker lights for ECS entity creation
      this.pendingFlickerLights = built.flickerLights;

      // Store particle systems for per-frame updates
      this.activeParticles = built.particleSystems;

      // Store parallax layers for per-frame UV scroll
      this.parallaxLayers = built.parallaxLayers;

      // Track NPC colors for AssetManager release on unload (legacy fallback)
      this.currentNpcColors = data.npcs.map(n => n.spriteColor);

      // Queue player spawn (consumed by RoomTransitionSystem)
      this.pendingSpawn = { x: spawnX, y: spawnY, z: spawnZ };

      // Force shadow map update
      this.deps.renderer.shadowMap.needsUpdate = true;

      // Profile room after load
      profileRoom(this.deps.renderer, roomId, data.name);

      // Hold black
      await this.delay(HOLD_BLACK_MS, signal);
      if (signal.aborted) return;

      // --- FADING_IN ---
      this.transitionState = TransitionState.FADING_IN;
      this.teleported = true;
      await this.fade(0, FADE_IN_MS, signal);

      // Back to IDLE
      this.transitionState = TransitionState.IDLE;
    } finally {
      this.transitioning = false;
      this.abortController = null;
    }
  }

  /**
   * Update all active particle systems and parallax scrolling.
   * Called once per frame from the game loop.
   */
  updateParticles(dt: number): void {
    for (const ps of this.activeParticles) {
      ps.update(dt);
    }

    // Scroll parallax layers based on camera X position normalized to room width.
    // scrollFactor from ParallaxLayerDef: 0 = static, 1 = moves with camera.
    if (this.parallaxLayers.length > 0 && this.currentRoomData) {
      const cameraX = this.deps.camera.position.x;
      const roomWidth = this.currentRoomData.dimensions.width;
      for (const layer of this.parallaxLayers) {
        const scrollFactor = layer.userData.scrollFactor as number;
        const mat = layer.material as THREE.MeshBasicMaterial;
        if (mat.map) {
          mat.map.offset.x = (cameraX / roomWidth) * scrollFactor;
        }
      }
    }
  }

  /**
   * Dispose the RoomManager and all its resources.
   */
  dispose(): void {
    this.abortController?.abort();
    this.unloadCurrentRoom();
    this.fadeOverlay.remove();
  }

  private unloadCurrentRoom(): void {
    if (!this.currentRoom) return;

    const roomId = this.currentRoomId;

    // Signal ECS to destroy FlickerLight entities from this room
    this.pendingFlickerCleanup = true;

    // Unregister sprite animators before room disposal
    if (this.currentRoom.spriteAnimators) {
      for (const anim of this.currentRoom.spriteAnimators) {
        unregisterAnimator(anim);
      }
    }

    // Dispose particle systems before clearing references
    for (const ps of this.activeParticles) {
      ps.dispose();
    }
    this.activeParticles = [];
    this.parallaxLayers = [];

    this.deps.scene.remove(this.currentRoom.group);
    disposeRoom(this.currentRoom.group, this.currentRoomData ?? undefined, this.currentNpcColors);
    this.currentRoom = null;
    this.currentRoomData = null;
    this.doorTriggers = [];
    this.currentNpcColors = [];

    // Log disposal metrics
    profileDisposal(this.deps.renderer, roomId, `room-${roomId}`);
  }

  private fade(targetOpacity: number, durationMs: number, signal: AbortSignal): Promise<void> {
    return new Promise<void>((resolve) => {
      if (signal.aborted) { resolve(); return; }

      this.fadeOverlay.style.transition = `opacity ${durationMs}ms ease-in-out`;
      this.fadeOverlay.style.opacity = String(targetOpacity);

      const onEnd = () => {
        this.fadeOverlay.removeEventListener('transitionend', onEnd);
        resolve();
      };
      this.fadeOverlay.addEventListener('transitionend', onEnd);

      // Safety timeout in case transitionend doesn't fire
      setTimeout(() => {
        this.fadeOverlay.removeEventListener('transitionend', onEnd);
        resolve();
      }, durationMs + 100);
    });
  }

  private delay(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise<void>((resolve) => {
      if (signal.aborted) { resolve(); return; }
      setTimeout(resolve, ms);
    });
  }
}
