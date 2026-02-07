import * as THREE from 'three';
import Stats from 'stats-gl';
import { createRenderer, createCamera } from './rendering/renderer-setup.js';
import { createHD2DPipeline } from './rendering/hd2d-pipeline.js';
import { renderContext } from './rendering/render-context.js';
import { createWorld } from './ecs/world.js';
import { GameLoop } from './game-loop.js';
import { Transform, MovementIntent, transformInit } from './ecs/components/transform.js';
import { Object3DRef, FlickerLight } from './ecs/components/rendering.js';
import { PlayerTag } from './ecs/components/tags.js';
import { RoomId } from './ecs/components/singletons.js';
import { RoomTransitionSystem } from './ecs/systems/room-transition.js';
import { RoomManager } from './rooms/RoomManager.js';
import { createSpriteMesh, createBlobShadow, updateBillboards } from './rendering/sprite-factory.js';
import { updateAnimators } from './rendering/sprite-animator.js';
import { createPlayerSpriteTexture } from './rendering/placeholder-textures.js';
import { getKeyboard, disposeKeyboard } from './input/keyboard.js';
import { createQualityScaler } from './rendering/quality-scaler.js';
import { assetManager } from './loaders/asset-manager.js';
import { createLoaders, textureLoader } from './loaders/texture-loaders.js';

async function init(): Promise<void> {
  // --- Three.js setup ---
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a14);

  const camera = createCamera();
  const renderer = createRenderer();
  document.body.appendChild(renderer.domElement);

  const pipeline = createHD2DPipeline(renderer, scene, camera);

  // Wire up asset loaders (GLTF, KTX2, DRACO)
  const loaders = createLoaders(renderer);

  // Populate render context singleton
  renderContext.scene = scene;
  renderContext.camera = camera;
  renderContext.renderer = renderer;
  renderContext.composer = pipeline.composer;

  // --- ECS setup ---
  const world = await createWorld();

  // --- Room Manager ---
  const roomManager = new RoomManager({ scene, renderer, camera, pipeline, loaderSet: loaders });
  RoomTransitionSystem.roomManager = roomManager;

  // --- Load initial room (before world.build — queues flicker lights) ---
  await roomManager.loadRoom(RoomId.ThroneRoom);

  // --- Create player entity ---
  let playerTex: THREE.Texture;
  try {
    playerTex = await textureLoader.loadAsync('assets/sprites/player/knight-idle.png');
    playerTex.minFilter = THREE.NearestFilter;
    playerTex.magFilter = THREE.NearestFilter;
    playerTex.generateMipmaps = false;
    playerTex.colorSpace = THREE.SRGBColorSpace;
  } catch {
    // Fall back to procedural if sprite file not found
    playerTex = createPlayerSpriteTexture();
  }
  const playerMesh = createSpriteMesh(playerTex);
  const playerShadow = createBlobShadow(0.5);
  playerMesh.add(playerShadow);
  playerShadow.position.set(0, -0.74, 0);
  scene.add(playerMesh);

  // Create ALL initial entities in a single world.build() call
  // (Becsy only allows build() before execution starts)
  const initialFlickerLights = roomManager.pendingFlickerLights;
  roomManager.pendingFlickerLights = [];

  world.build((sys) => {
    sys.createEntity(
      PlayerTag,
      Transform, transformInit(),
      MovementIntent, { dx: 0, dz: 0 },
      Object3DRef, { object3d: playerMesh },
    );

    for (let i = 0; i < initialFlickerLights.length; i++) {
      const light = initialFlickerLights[i]!;
      sys.createEntity(
        FlickerLight, {
          baseIntensity: light.intensity,
          baseColor: light.color.getHex(),
          noiseOffset: i * 37.5,
        },
        Object3DRef, { object3d: light },
      );
    }
  });

  // --- Initialize keyboard ---
  getKeyboard();

  // --- Dynamic quality scaler ---
  const qualityScaler = createQualityScaler(pipeline);

  // --- Start game loop ---
  const loop = new GameLoop(world);
  loop.onFrameTick = (dt) => {
    roomManager.updateParticles(dt);
    updateBillboards(camera);
    updateAnimators(dt);
  };
  loop.start();

  // --- Hide loading screen ---
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.classList.add('hidden');
    // Remove from DOM after fade-out completes
    loadingScreen.addEventListener('transitionend', () => loadingScreen.remove(), { once: true });
  }

  // --- Event handlers (cleaned up via AbortController) ---
  const eventsController = new AbortController();
  const evtOpts: AddEventListenerOptions = { signal: eventsController.signal };

  // Window resize
  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    pipeline.composer.setSize(w, h);
  }, evtOpts);

  // Visibility change — pause on tab hide, clear sticky keys, resume on tab show
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      getKeyboard().clearAll();
      loop.pause();
    } else {
      loop.resetDeltaTime();
      loop.resume();
    }
  }, evtOpts);

  // WebGL context loss/restore
  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    loop.pause();
  }, evtOpts);

  renderer.domElement.addEventListener('webglcontextrestored', () => {
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const mat = obj.material;
        if (mat instanceof THREE.Material && 'map' in mat && mat.map) {
          (mat.map as THREE.Texture).needsUpdate = true;
        }
        mat.needsUpdate = true;
      }
    });
    pipeline.composer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.needsUpdate = true;
    loop.resetDeltaTime();
    loop.resume();
  }, evtOpts);

  // --- stats-gl performance monitor ---
  const stats = new Stats({
    trackGPU: true,
    trackCPT: false,
    trackHz: false,
  });
  document.body.appendChild(stats.dom);
  await stats.init(renderer);
  loop.onBeforeExecute = () => stats.begin();
  loop.onAfterExecute = (deltaMs) => {
    stats.end();
    stats.update();
    qualityScaler.update(deltaMs);
  };

  // --- Dev-mode debug ---
  if (import.meta.env.DEV) {
    const { createDebugOverlay } = await import('./debug/debug-overlay.js');
    const debugOverlay = createDebugOverlay(pipeline);

    const logInterval = setInterval(() => {
      const info = renderer.info;
      console.log(
        `[perf] draw calls: ${info.render.calls}, triangles: ${info.render.triangles}, ` +
        `textures: ${info.memory.textures}, geometries: ${info.memory.geometries}`,
      );
    }, 2000);

    // Cleanup on HMR
    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        loop.stop();
        eventsController.abort();
        disposeKeyboard();
        clearInterval(logInterval);
        debugOverlay.dispose();
        roomManager.dispose();
        RoomTransitionSystem.roomManager = null;
        stats.dispose();
        stats.dom.remove();
        scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry?.dispose();
            const mat = obj.material;
            if (mat instanceof THREE.Material) {
              if ('map' in mat && mat.map) (mat.map as THREE.Texture).dispose();
              mat.dispose();
            }
          }
        });
        assetManager.dispose();
        loaders.dispose();
        pipeline.composer.dispose();
        renderer.dispose();
        document.body.removeChild(renderer.domElement);
      });
    }
  }
}

init().catch((err) => {
  console.error('Failed to initialize:', err);
});
