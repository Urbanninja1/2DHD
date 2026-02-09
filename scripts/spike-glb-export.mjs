/**
 * GLB Export Spike — validates the prop generation pipeline on Windows.
 *
 * Tests:
 * 1. Create a BoxGeometry + MeshStandardMaterial with DataTexture (simplex noise)
 * 2. Export to GLB via node-three-gltf's GLTFExporter
 * 3. CSG boolean subtraction via three-bvh-csg
 * 4. Export CSG result to GLB
 *
 * Usage: node scripts/spike-glb-export.mjs
 */

import * as THREE from 'three';
import { GLTFExporter } from 'node-three-gltf';
import { createNoise2D } from 'simplex-noise';
import { Evaluator, Brush } from 'three-bvh-csg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '../public/assets/models/props');

// ─── Helpers ─────────────────────────────────────────────────────────

/** Create a 256x256 DataTexture filled with simplex noise. */
function createNoiseTexture(width = 256, height = 256) {
  const noise2D = createNoise2D();
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // Multi-octave simplex noise → grey stone-like texture
      const n1 = noise2D(x / 64, y / 64) * 0.5 + 0.5;
      const n2 = noise2D(x / 32, y / 32) * 0.25;
      const n3 = noise2D(x / 16, y / 16) * 0.125;
      const val = Math.min(255, Math.max(0, Math.floor((n1 + n2 + n3) * 180 + 40)));
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  // node-three-gltf's GLTFExporter uses sharp() which expects image.channels
  // Three.js DataTexture doesn't set this, so we add it manually.
  tex.image.channels = 4;
  return tex;
}

/** Export a Three.js object to GLB and write to disk. Returns file size in bytes. */
async function exportGLB(object, outputPath) {
  const exporter = new GLTFExporter();
  const glb = await exporter.parseAsync(object, { binary: true });

  // node-three-gltf returns a Node.js Buffer
  fs.writeFileSync(outputPath, Buffer.from(glb));
  const stats = fs.statSync(outputPath);
  return stats.size;
}

// ─── Test 1: Simple Box with DataTexture ─────────────────────────────

async function testSimpleBox() {
  console.log('\n--- Test 1: Simple Box + DataTexture ---');

  const scene = new THREE.Scene();
  const tex = createNoiseTexture();
  const material = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.8,
    metalness: 0.1,
  });
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  const outPath = path.join(OUTPUT_DIR, 'test-spike-box.glb');
  const size = await exportGLB(scene, outPath);

  console.log(`  Output: ${outPath}`);
  console.log(`  Size:   ${size} bytes`);

  if (size <= 0) throw new Error('GLB file is empty!');
  console.log('  PASSED');

  // Cleanup
  geometry.dispose();
  material.dispose();
  tex.dispose();

  return size;
}

// ─── Test 2: CSG Boolean Subtraction ─────────────────────────────────

async function testCSG() {
  console.log('\n--- Test 2: CSG Boolean Subtraction ---');

  const scene = new THREE.Scene();
  const material = new THREE.MeshStandardMaterial({
    color: 0x5a554f,
    roughness: 0.85,
    metalness: 0.05,
  });

  // Base: a box
  const boxGeo = new THREE.BoxGeometry(2, 2, 2);
  const boxBrush = new Brush(boxGeo, material);
  boxBrush.updateMatrixWorld();

  // Subtraction: a cylinder carved through the center
  const cylGeo = new THREE.CylinderGeometry(0.6, 0.6, 3, 8);
  const cylBrush = new Brush(cylGeo, material);
  cylBrush.updateMatrixWorld();

  // Perform CSG subtraction
  const evaluator = new Evaluator();
  evaluator.useGroups = false;
  const result = evaluator.evaluate(boxBrush, cylBrush, 0); // 0 = SUBTRACTION

  scene.add(result);

  const outPath = path.join(OUTPUT_DIR, 'test-spike-csg.glb');
  const size = await exportGLB(scene, outPath);

  console.log(`  Output: ${outPath}`);
  console.log(`  Size:   ${size} bytes`);
  console.log(`  Tris:   ${result.geometry.index ? result.geometry.index.count / 3 : 'N/A'}`);

  if (size <= 0) throw new Error('CSG GLB file is empty!');
  console.log('  PASSED');

  // Cleanup
  boxGeo.dispose();
  cylGeo.dispose();
  result.geometry.dispose();
  material.dispose();

  return size;
}

// ─── Test 3: CSG + DataTexture (combined) ────────────────────────────

async function testCSGWithTexture() {
  console.log('\n--- Test 3: CSG + DataTexture (combined) ---');

  const scene = new THREE.Scene();
  const tex = createNoiseTexture();
  const material = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.7,
    metalness: 0.0,
  });

  // A column-like shape: cylinder minus smaller cylinder (hollow column)
  const outerGeo = new THREE.CylinderGeometry(0.5, 0.6, 4, 8);
  const outerBrush = new Brush(outerGeo, material);
  outerBrush.updateMatrixWorld();

  const innerGeo = new THREE.CylinderGeometry(0.35, 0.35, 4.5, 8);
  const innerBrush = new Brush(innerGeo, material);
  innerBrush.updateMatrixWorld();

  const evaluator = new Evaluator();
  evaluator.useGroups = false;
  const result = evaluator.evaluate(outerBrush, innerBrush, 0); // SUBTRACTION

  // Translate so origin is at base
  result.geometry.translate(0, 2, 0);
  scene.add(result);

  const outPath = path.join(OUTPUT_DIR, 'test-spike-column.glb');
  const size = await exportGLB(scene, outPath);

  console.log(`  Output: ${outPath}`);
  console.log(`  Size:   ${size} bytes`);
  console.log(`  Tris:   ${result.geometry.index ? result.geometry.index.count / 3 : 'N/A'}`);

  if (size <= 0) throw new Error('Combined CSG+texture GLB is empty!');
  console.log('  PASSED');

  // Cleanup
  outerGeo.dispose();
  innerGeo.dispose();
  result.geometry.dispose();
  material.dispose();
  tex.dispose();

  return size;
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log('GLB Export Spike — validating pipeline on Windows');
  console.log(`Output dir: ${OUTPUT_DIR}`);

  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const results = {};

  try {
    results.box = await testSimpleBox();
    results.csg = await testCSG();
    results.csgTexture = await testCSGWithTexture();

    console.log('\n=== ALL TESTS PASSED ===');
    console.log('Pipeline validated:');
    console.log(`  - DataTexture → GLB export:     OK (${results.box} bytes)`);
    console.log(`  - CSG subtraction → GLB export:  OK (${results.csg} bytes)`);
    console.log(`  - CSG + DataTexture → GLB:       OK (${results.csgTexture} bytes)`);
    console.log('\nReady to proceed with prop generation.');
  } catch (err) {
    console.error('\n=== SPIKE FAILED ===');
    console.error(err);
    process.exit(1);
  }
}

main();
