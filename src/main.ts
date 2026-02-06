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
import { buildTestRoom, getTestRoomTorches } from './test-room.js';
import { createSpriteMesh, createBlobShadow } from './rendering/sprite-factory.js';
import { createPlayerSpriteTexture } from './rendering/placeholder-textures.js';
import { getKeyboard, disposeKeyboard } from './input/keyboard.js';

async function init(): Promise<void> {
  // --- Three.js setup ---
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a14);

  const camera = createCamera();
  const renderer = createRenderer();
  document.body.appendChild(renderer.domElement);

  const pipeline = createHD2DPipeline(renderer, scene, camera);

  // Populate render context singleton
  renderContext.scene = scene;
  renderContext.camera = camera;
  renderContext.renderer = renderer;
  renderContext.composer = pipeline.composer;

  // --- Build test room ---
  const roomGroup = buildTestRoom();
  scene.add(roomGroup);

  // Trigger shadow map render once (static scene)
  renderer.shadowMap.needsUpdate = true;

  // --- ECS setup ---
  const world = await createWorld();

  // Create player entity
  const playerTex = createPlayerSpriteTexture();
  const playerMesh = createSpriteMesh(playerTex);
  const playerShadow = createBlobShadow(0.5);
  playerMesh.add(playerShadow);
  playerShadow.position.set(0, -0.74, 0); // Relative to sprite (origin is at feet + offset)
  scene.add(playerMesh);

  // Create all initial entities in a single build call (Becsy only allows one)
  const torches = getTestRoomTorches(roomGroup);
  world.build((sys) => {
    sys.createEntity(
      PlayerTag,
      Transform, transformInit(),
      MovementIntent, { dx: 0, dz: 0 },
      Object3DRef, { object3d: playerMesh },
    );

    for (let i = 0; i < torches.length; i++) {
      const torch = torches[i]!;
      sys.createEntity(
        FlickerLight, {
          baseIntensity: torch.intensity,
          baseColor: torch.color.getHex(),
          noiseOffset: i * 37.5, // Different offset per torch
        },
        Object3DRef, { object3d: torch },
      );
    }
  });

  // --- Initialize keyboard ---
  getKeyboard();

  // --- Start game loop ---
  const loop = new GameLoop(world);
  loop.start();

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
    // Force re-upload of all textures after context invalidation
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const mat = obj.material;
        if (mat instanceof THREE.Material && 'map' in mat && mat.map) {
          (mat.map as THREE.Texture).needsUpdate = true;
        }
        mat.needsUpdate = true;
      }
    });
    // Recreate EffectComposer render targets
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
  // Wire stats into game loop
  loop.onBeforeExecute = () => stats.begin();
  loop.onAfterExecute = () => { stats.end(); stats.update(); };

  // --- Dev-mode debug ---
  if (import.meta.env.DEV) {
    const { createDebugOverlay } = await import('./debug/debug-overlay.js');
    const debugOverlay = createDebugOverlay(pipeline);

    // Log renderer info periodically
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
        stats.dispose();
        stats.dom.remove();
        // Dispose scene graph resources (textures, geometries, materials)
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
