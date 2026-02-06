import * as THREE from 'three';

export function createRenderer(): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    stencil: false,
    depth: false,
    powerPreference: 'high-performance',
  });

  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;

  renderer.setPixelRatio(1); // Consistent quality, postprocessing handles resolution
  renderer.setSize(window.innerWidth, window.innerHeight);

  return renderer;
}

export function createCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(
    35, // Narrow FoV — HD-2D diorama feel
    window.innerWidth / window.innerHeight,
    0.1,
    500,
  );

  // HD-2D 3/4 angle: ~38° from horizontal
  camera.position.set(0, 18, 22);
  camera.lookAt(0, 0, 0);

  return camera;
}
