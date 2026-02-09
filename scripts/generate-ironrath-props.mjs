#!/usr/bin/env node

/**
 * Ironrath Castle — Prop Generation Script
 *
 * Single catalog-driven script generating all Great Hall props as GLB files.
 * Inline helpers — extract to scripts/lib/ after Phase 2 when patterns are proven.
 *
 * Props that use CSG: hearth, throne, chandelier, weapon-rack (~4)
 * Everything else: simple primitive compositions with MeshStandardMaterial.
 *
 * Usage: node scripts/generate-ironrath-props.mjs
 */

import * as THREE from 'three';
import { GLTFExporter } from 'node-three-gltf';
import { createNoise2D } from 'simplex-noise';
import { Evaluator, Brush } from 'three-bvh-csg';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '../public/assets/models/props/ironrath');

// ─── Shared State ────────────────────────────────────────────────────

const evaluator = new Evaluator();
evaluator.useGroups = false;

const noise2D = createNoise2D();

// ─── Inline Helpers ──────────────────────────────────────────────────

/** Export a Three.js object to GLB and write to disk. */
async function exportGLB(object, outputPath) {
  const exporter = new GLTFExporter();
  const glb = await exporter.parseAsync(object, { binary: true });
  fs.writeFileSync(outputPath, Buffer.from(glb));
  return fs.statSync(outputPath).size;
}

/** Dispose all GPU resources in a scene. */
function disposeScene(scene) {
  scene.traverse((obj) => {
    if (obj.geometry) {
      obj.geometry.dispose();
    }
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach(m => { m.map?.dispose(); m.dispose(); });
      } else {
        obj.material.map?.dispose();
        obj.material.dispose();
      }
    }
  });
}

/** Create a DataTexture with simplex noise (stone-like). */
function createStoneTexture(w = 256, h = 256, baseR = 74, baseG = 69, baseB = 64) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const n1 = noise2D(x / 64, y / 64) * 0.5 + 0.5;
      const n2 = noise2D(x / 32, y / 32) * 0.25;
      const n3 = noise2D(x / 16, y / 16) * 0.125;
      const v = n1 + n2 + n3;
      data[idx]     = Math.min(255, Math.max(0, Math.floor(baseR * v + 30)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.floor(baseG * v + 25)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.floor(baseB * v + 20)));
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.image.channels = 4;
  return tex;
}

/** Create a wood grain DataTexture. */
function createWoodTexture(w = 256, h = 256, baseR = 31, baseG = 21, baseB = 16) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      // Directional grain
      const grain = noise2D(x / 8, y / 128) * 0.3 + 0.5;
      // Growth rings
      const ring = Math.sin(noise2D(x / 64, y / 64) * 8) * 0.15 + 0.5;
      // Knot noise
      const knot = noise2D(x / 24, y / 24) * 0.1;
      const v = grain + ring * 0.4 + knot;
      data[idx]     = Math.min(255, Math.max(0, Math.floor(baseR * v * 2.5 + 15)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.floor(baseG * v * 2.5 + 10)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.floor(baseB * v * 2.5 + 5)));
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.image.channels = 4;
  return tex;
}

/** Create a metal DataTexture. */
function createMetalTexture(w = 128, h = 128) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const n = noise2D(x / 32, y / 32) * 0.3 + 0.5;
      const scratch = noise2D(x / 4, y / 64) * 0.15;
      const v = n + scratch;
      const base = Math.floor(42 * v + 20);
      data[idx] = base;
      data[idx + 1] = base;
      data[idx + 2] = base + 5;
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.image.channels = 4;
  return tex;
}

/** Create a fabric DataTexture. */
function createFabricTexture(w = 128, h = 128, r = 45, g = 90, b = 39) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const warp = Math.sin(x * 0.8) * 0.05;
      const weft = Math.sin(y * 0.8) * 0.05;
      const n = noise2D(x / 16, y / 16) * 0.15 + 0.5 + warp + weft;
      data[idx]     = Math.min(255, Math.max(0, Math.floor(r * n * 2)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.floor(g * n * 2)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.floor(b * n * 2)));
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.image.channels = 4;
  return tex;
}

/** Create an alpha-masked detail texture (cracks, moss, etc). */
function createDetailTexture(w = 128, h = 128, r = 40, g = 40, b = 35, threshold = 0.55) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const n = noise2D(x / 20, y / 20) * 0.5 + 0.5;
      const detail = noise2D(x / 8, y / 8) * 0.3;
      const v = n + detail;
      if (v > threshold) {
        const alpha = Math.min(255, Math.floor((v - threshold) * 4 * 255));
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = alpha;
      }
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.image.channels = 4;
  return tex;
}

/** Northern stone material. */
function stoneMat(tex) {
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0 });
}

/** Ironwood material. */
function woodMat(tex) {
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0 });
}

/** Weathered iron material. */
function ironMat(tex) {
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.8 });
}

/** Simple color material (no texture). */
function colorMat(color, roughness = 0.8, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

/** Merge multiple geometries + apply material to a single Mesh. */
function mergeMesh(geos, material) {
  const merged = mergeGeometries(geos, false);
  geos.forEach(g => g.dispose());
  return new THREE.Mesh(merged, material);
}

/** CSG subtract: A minus B. Both are Brush-wrapped. */
function csgSubtract(geoA, geoB, material) {
  const brushA = new Brush(geoA, material);
  brushA.updateMatrixWorld();
  const brushB = new Brush(geoB, material);
  brushB.updateMatrixWorld();
  const result = evaluator.evaluate(brushA, brushB, 0);
  geoA.dispose();
  geoB.dispose();
  return result;
}

// ─── Prop Generation Functions ───────────────────────────────────────

function generateColumn() {
  const scene = new THREE.Scene();
  const tex = createWoodTexture(256, 256);
  const mat = woodMat(tex);

  // Octagonal column shaft
  const shaft = new THREE.CylinderGeometry(0.35, 0.4, 9, 8);
  shaft.translate(0, 4.5, 0);
  // Base plinth
  const base = new THREE.CylinderGeometry(0.5, 0.55, 0.6, 8);
  base.translate(0, 0.3, 0);
  // Capital
  const capital = new THREE.CylinderGeometry(0.5, 0.35, 0.5, 8);
  capital.translate(0, 9.25, 0);

  scene.add(mergeMesh([shaft, base, capital], mat));
  return scene;
}

function generateHearth() {
  const scene = new THREE.Scene();
  const tex = createStoneTexture(256, 256, 80, 75, 70);
  const mat = stoneMat(tex);

  // Back wall slab
  const back = new THREE.BoxGeometry(4, 3, 0.4);
  back.translate(0, 1.5, -0.2);
  // Left pillar
  const left = new THREE.BoxGeometry(0.5, 3, 0.8);
  left.translate(-2, 1.5, 0);
  // Right pillar
  const right = new THREE.BoxGeometry(0.5, 3, 0.8);
  right.translate(2, 1.5, 0);
  // Mantel (lintel above opening)
  const mantel = new THREE.BoxGeometry(5, 0.4, 1);
  mantel.translate(0, 3.2, 0);
  // Hearth floor
  const floor = new THREE.BoxGeometry(3.5, 0.15, 0.8);
  floor.translate(0, 0.075, 0.1);

  // CSG: carve the firebox opening from a solid block
  const solid = new THREE.BoxGeometry(3.5, 2.5, 0.6);
  solid.translate(0, 1.25, 0);
  const cutout = new THREE.BoxGeometry(2.8, 2.0, 0.8);
  cutout.translate(0, 1.0, 0.2);

  const carved = csgSubtract(solid, cutout, mat);
  scene.add(carved);

  scene.add(mergeMesh([back, left, right, mantel, floor], mat));
  return scene;
}

function generateThrone() {
  const scene = new THREE.Scene();
  const tex = createWoodTexture(256, 256, 25, 18, 12);
  const mat = woodMat(tex);

  // Seat
  const seat = new THREE.BoxGeometry(1.2, 0.15, 1.0);
  seat.translate(0, 1.0, 0);
  // Back rest (tall)
  const backrest = new THREE.BoxGeometry(1.2, 2.0, 0.15);
  backrest.translate(0, 2.1, -0.425);
  // Left armrest
  const armL = new THREE.BoxGeometry(0.12, 0.6, 0.8);
  armL.translate(-0.54, 1.4, 0.05);
  // Right armrest
  const armR = new THREE.BoxGeometry(0.12, 0.6, 0.8);
  armR.translate(0.54, 1.4, 0.05);
  // Front legs
  const legFL = new THREE.BoxGeometry(0.12, 1.0, 0.12);
  legFL.translate(-0.5, 0.5, 0.4);
  const legFR = new THREE.BoxGeometry(0.12, 1.0, 0.12);
  legFR.translate(0.5, 0.5, 0.4);
  // Back legs (taller, support backrest)
  const legBL = new THREE.BoxGeometry(0.12, 3.0, 0.12);
  legBL.translate(-0.5, 1.5, -0.4);
  const legBR = new THREE.BoxGeometry(0.12, 3.0, 0.12);
  legBR.translate(0.5, 1.5, -0.4);

  // CSG: carve ironwood crest into backrest top
  const crestBlock = new THREE.BoxGeometry(0.8, 0.6, 0.3);
  crestBlock.translate(0, 2.9, -0.425);
  const crestCut = new THREE.CylinderGeometry(0.25, 0.25, 0.4, 6);
  crestCut.rotateX(Math.PI / 2);
  crestCut.translate(0, 2.9, -0.425);
  const crest = csgSubtract(crestBlock, crestCut, mat);
  scene.add(crest);

  scene.add(mergeMesh([seat, backrest, armL, armR, legFL, legFR, legBL, legBR], mat));
  return scene;
}

function generateTable() {
  const scene = new THREE.Scene();
  const tex = createWoodTexture(256, 256, 35, 25, 18);
  const mat = woodMat(tex);

  // Table top
  const top = new THREE.BoxGeometry(6.0, 0.12, 1.4);
  top.translate(0, 1.0, 0);
  // Legs (trestle style — 2 wide boards)
  const legL = new THREE.BoxGeometry(0.12, 0.95, 1.2);
  legL.translate(-2.5, 0.475, 0);
  const legR = new THREE.BoxGeometry(0.12, 0.95, 1.2);
  legR.translate(2.5, 0.475, 0);
  // Cross beam
  const beam = new THREE.BoxGeometry(5.0, 0.1, 0.1);
  beam.translate(0, 0.3, 0);

  scene.add(mergeMesh([top, legL, legR, beam], mat));
  return scene;
}

function generateBench() {
  const scene = new THREE.Scene();
  const mat = colorMat(0x3a2a1a, 0.7);

  const seat = new THREE.BoxGeometry(2.0, 0.08, 0.5);
  seat.translate(0, 0.55, 0);
  const legL = new THREE.BoxGeometry(0.08, 0.55, 0.4);
  legL.translate(-0.85, 0.275, 0);
  const legR = new THREE.BoxGeometry(0.08, 0.55, 0.4);
  legR.translate(0.85, 0.275, 0);

  scene.add(mergeMesh([seat, legL, legR], mat));
  return scene;
}

function generateChandelier() {
  const scene = new THREE.Scene();
  const tex = createMetalTexture();
  const mat = ironMat(tex);

  // Central ring
  const ring = new THREE.TorusGeometry(0.6, 0.06, 6, 8);
  ring.rotateX(Math.PI / 2);
  // Chain link (simplified as cylinder)
  const chain = new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6);
  chain.translate(0, 0.75, 0);
  // Candle holders (4 around ring)
  const holders = [];
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const cup = new THREE.CylinderGeometry(0.06, 0.04, 0.12, 6);
    cup.translate(Math.cos(angle) * 0.6, 0.06, Math.sin(angle) * 0.6);
    holders.push(cup);
    // Candle
    const candle = new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6);
    candle.translate(Math.cos(angle) * 0.6, 0.22, Math.sin(angle) * 0.6);
    holders.push(candle);
  }

  scene.add(mergeMesh([ring, chain, ...holders], mat));
  return scene;
}

function generateSconce() {
  const scene = new THREE.Scene();
  const mat = colorMat(0x4a3a2a, 0.6, 0.3);

  // Wall bracket
  const bracket = new THREE.BoxGeometry(0.15, 0.25, 0.12);
  bracket.translate(0, 0, -0.06);
  // Arm
  const arm = new THREE.BoxGeometry(0.08, 0.08, 0.25);
  arm.translate(0, 0, 0.06);
  // Cup
  const cup = new THREE.CylinderGeometry(0.08, 0.06, 0.1, 6);
  cup.translate(0, 0.05, 0.15);

  scene.add(mergeMesh([bracket, arm, cup], mat));
  return scene;
}

function generateBanner() {
  const scene = new THREE.Scene();
  const tex = createFabricTexture(128, 128, 26, 26, 26); // dark Forrester
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0, side: THREE.DoubleSide });

  // Banner cloth (flat plane)
  const cloth = new THREE.PlaneGeometry(1.2, 3.0);
  cloth.translate(0, 1.5, 0);
  // Pole
  const pole = new THREE.CylinderGeometry(0.03, 0.03, 3.4, 6);
  pole.translate(0, 1.7, 0);

  const meshCloth = new THREE.Mesh(cloth, mat);
  const meshPole = new THREE.Mesh(pole, colorMat(0x3a3a3a, 0.5, 0.3));
  scene.add(meshCloth);
  scene.add(meshPole);
  return scene;
}

function generateChair() {
  const scene = new THREE.Scene();
  const mat = colorMat(0x2a1a0e, 0.7);

  const seat = new THREE.BoxGeometry(0.6, 0.08, 0.6);
  seat.translate(0, 0.7, 0);
  const back = new THREE.BoxGeometry(0.6, 0.8, 0.06);
  back.translate(0, 1.1, -0.27);
  const legFL = new THREE.BoxGeometry(0.06, 0.7, 0.06);
  legFL.translate(-0.24, 0.35, 0.24);
  const legFR = new THREE.BoxGeometry(0.06, 0.7, 0.06);
  legFR.translate(0.24, 0.35, 0.24);
  const legBL = new THREE.BoxGeometry(0.06, 1.5, 0.06);
  legBL.translate(-0.24, 0.75, -0.24);
  const legBR = new THREE.BoxGeometry(0.06, 1.5, 0.06);
  legBR.translate(0.24, 0.75, -0.24);

  scene.add(mergeMesh([seat, back, legFL, legFR, legBL, legBR], mat));
  return scene;
}

function generateHighSeat() {
  const scene = new THREE.Scene();
  const tex = createWoodTexture(128, 128, 30, 22, 15);
  const mat = woodMat(tex);

  // Like chair but wider + armrests
  const seat = new THREE.BoxGeometry(0.9, 0.1, 0.7);
  seat.translate(0, 0.8, 0);
  const back = new THREE.BoxGeometry(0.9, 1.2, 0.08);
  back.translate(0, 1.4, -0.31);
  const armL = new THREE.BoxGeometry(0.08, 0.35, 0.5);
  armL.translate(-0.41, 1.0, 0.05);
  const armR = new THREE.BoxGeometry(0.08, 0.35, 0.5);
  armR.translate(0.41, 1.0, 0.05);
  const legFL = new THREE.BoxGeometry(0.08, 0.8, 0.08);
  legFL.translate(-0.36, 0.4, 0.28);
  const legFR = new THREE.BoxGeometry(0.08, 0.8, 0.08);
  legFR.translate(0.36, 0.4, 0.28);
  const legBL = new THREE.BoxGeometry(0.08, 2.0, 0.08);
  legBL.translate(-0.36, 1.0, -0.28);
  const legBR = new THREE.BoxGeometry(0.08, 2.0, 0.08);
  legBR.translate(0.36, 1.0, -0.28);

  scene.add(mergeMesh([seat, back, armL, armR, legFL, legFR, legBL, legBR], mat));
  return scene;
}

function generateDais() {
  const scene = new THREE.Scene();
  const tex = createStoneTexture(256, 256, 60, 55, 50);
  const mat = stoneMat(tex);

  // Raised platform — two tiers
  const lower = new THREE.BoxGeometry(6, 0.2, 3);
  lower.translate(0, 0.1, 0);
  const upper = new THREE.BoxGeometry(5, 0.2, 2.5);
  upper.translate(0, 0.3, -0.1);

  scene.add(mergeMesh([lower, upper], mat));
  return scene;
}

function generateGoblet() {
  const scene = new THREE.Scene();
  const mat = colorMat(0x8a7a5a, 0.4, 0.6);

  // Stem
  const stem = new THREE.CylinderGeometry(0.02, 0.04, 0.12, 6);
  stem.translate(0, 0.06, 0);
  // Cup (cone flared upward)
  const cup = new THREE.CylinderGeometry(0.06, 0.03, 0.1, 6);
  cup.translate(0, 0.17, 0);
  // Base
  const base = new THREE.CylinderGeometry(0.05, 0.05, 0.02, 6);
  base.translate(0, 0.01, 0);

  scene.add(mergeMesh([stem, cup, base], mat));
  return scene;
}

function generatePlate() {
  const scene = new THREE.Scene();
  const mat = colorMat(0x6a5a4a, 0.6, 0.2);

  // Flat disc with slight rim
  const disc = new THREE.CylinderGeometry(0.15, 0.15, 0.015, 8);
  disc.translate(0, 0.0075, 0);
  const rim = new THREE.TorusGeometry(0.15, 0.01, 4, 8);
  rim.rotateX(Math.PI / 2);
  rim.translate(0, 0.015, 0);

  scene.add(mergeMesh([disc, rim], mat));
  return scene;
}

function generateCandelabra() {
  const scene = new THREE.Scene();
  const mat = colorMat(0x8a7a5a, 0.4, 0.7);

  // Central post
  const post = new THREE.CylinderGeometry(0.025, 0.04, 0.4, 6);
  post.translate(0, 0.2, 0);
  // Base
  const base = new THREE.CylinderGeometry(0.08, 0.08, 0.02, 6);
  base.translate(0, 0.01, 0);
  // Three candle arms
  const arms = [];
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const arm = new THREE.BoxGeometry(0.02, 0.02, 0.12);
    arm.translate(Math.cos(angle) * 0.06, 0.38, Math.sin(angle) * 0.06);
    arms.push(arm);
    // Candle
    const candle = new THREE.CylinderGeometry(0.015, 0.015, 0.12, 6);
    candle.translate(Math.cos(angle) * 0.1, 0.44, Math.sin(angle) * 0.1);
    arms.push(candle);
  }

  scene.add(mergeMesh([post, base, ...arms], mat));
  return scene;
}

function generateFoodPlatter() {
  const scene = new THREE.Scene();
  const mat = colorMat(0x5a4a3a, 0.7, 0.1);

  // Wooden platter (oval-ish)
  const platter = new THREE.CylinderGeometry(0.25, 0.25, 0.03, 8);
  platter.scale(1.4, 1, 1);
  platter.translate(0, 0.015, 0);
  // Food mound (simple hemisphere)
  const food = new THREE.SphereGeometry(0.12, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  food.translate(0, 0.03, 0);
  const foodMat = colorMat(0x8b6b3a, 0.9);
  const foodMesh = new THREE.Mesh(food, foodMat);

  scene.add(new THREE.Mesh(platter, mat));
  scene.add(foodMesh);
  return scene;
}

function generateWeaponRack() {
  const scene = new THREE.Scene();
  const tex = createWoodTexture(128, 128);
  const mat = woodMat(tex);
  const metalMat = colorMat(0x4a4a4a, 0.4, 0.7);

  // Back board
  const board = new THREE.BoxGeometry(1.5, 2.0, 0.08);
  board.translate(0, 1.0, 0);
  // Horizontal pegs (3 rows)
  const pegs = [];
  for (let i = 0; i < 3; i++) {
    const peg = new THREE.CylinderGeometry(0.02, 0.02, 0.15, 6);
    peg.rotateX(Math.PI / 2);
    peg.translate(-0.3, 0.5 + i * 0.6, 0.08);
    pegs.push(peg);
    const peg2 = peg.clone();
    peg2.translate(0.6, 0, 0);
    pegs.push(peg2);
  }

  // Sword shapes (flat boxes representing blades)
  const sword1 = new THREE.BoxGeometry(0.04, 0.9, 0.015);
  sword1.translate(-0.15, 1.1, 0.1);
  const sword2 = new THREE.BoxGeometry(0.04, 0.8, 0.015);
  sword2.translate(0.15, 1.0, 0.1);

  scene.add(mergeMesh([board, ...pegs], mat));
  scene.add(mergeMesh([sword1, sword2], metalMat));
  return scene;
}

function generateTapestry() {
  const scene = new THREE.Scene();
  const tex = createFabricTexture(128, 256, 50, 35, 28);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });

  const cloth = new THREE.PlaneGeometry(2.0, 3.0);
  cloth.translate(0, 1.5, 0);
  // Rod at top
  const rod = new THREE.CylinderGeometry(0.03, 0.03, 2.3, 6);
  rod.rotateZ(Math.PI / 2);
  rod.translate(0, 3.0, 0);

  scene.add(new THREE.Mesh(cloth, mat));
  scene.add(new THREE.Mesh(rod, colorMat(0x3a2a1a, 0.6, 0.2)));
  return scene;
}

function generateFurRug() {
  const scene = new THREE.Scene();
  const mat = colorMat(0x4a3828, 0.95);

  // Flat irregular shape (stretched disc)
  const rug = new THREE.CircleGeometry(1.2, 12);
  rug.scale(1.3, 1.0, 1.0);
  rug.rotateX(-Math.PI / 2);
  rug.translate(0, 0.01, 0);

  scene.add(new THREE.Mesh(rug, mat));
  return scene;
}

function generateRushes() {
  const scene = new THREE.Scene();
  const mat = colorMat(0x8B7355, 0.95);

  // Scattered patch of rushes — flat plane
  const patch = new THREE.PlaneGeometry(1.5, 1.5);
  patch.rotateX(-Math.PI / 2);
  patch.translate(0, 0.005, 0);

  scene.add(new THREE.Mesh(patch, mat));
  return scene;
}

function generateChest() {
  const scene = new THREE.Scene();
  const tex = createWoodTexture(128, 128, 40, 30, 20);
  const mat = woodMat(tex);

  // Box body
  const body = new THREE.BoxGeometry(0.8, 0.5, 0.5);
  body.translate(0, 0.25, 0);
  // Lid (slightly wider)
  const lid = new THREE.BoxGeometry(0.85, 0.1, 0.55);
  lid.translate(0, 0.55, 0);
  // Iron bands
  const bandMat = colorMat(0x3a3a3a, 0.4, 0.6);
  const band1 = new THREE.BoxGeometry(0.82, 0.04, 0.52);
  band1.translate(0, 0.2, 0);
  const band2 = new THREE.BoxGeometry(0.82, 0.04, 0.52);
  band2.translate(0, 0.4, 0);

  scene.add(mergeMesh([body, lid], mat));
  scene.add(mergeMesh([band1, band2], bandMat));
  return scene;
}

function generateHound() {
  const scene = new THREE.Scene();
  const mat = colorMat(0x5a4a3a, 0.8);

  // Simplified sleeping hound — low ellipsoid body
  const body = new THREE.SphereGeometry(0.3, 8, 6);
  body.scale(1.5, 0.5, 0.8);
  body.translate(0, 0.15, 0);
  // Head
  const head = new THREE.SphereGeometry(0.12, 6, 4);
  head.translate(0.4, 0.2, 0);

  scene.add(mergeMesh([body, head], mat));
  return scene;
}

// ─── Surface Detail Quads ────────────────────────────────────────────

function generateFloorCrack() {
  const scene = new THREE.Scene();
  const tex = createDetailTexture(128, 128, 30, 28, 25, 0.6);
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -4,
  });

  const quad = new THREE.PlaneGeometry(1.5, 1.5);
  quad.rotateX(-Math.PI / 2);
  quad.translate(0, 0.005, 0);
  scene.add(new THREE.Mesh(quad, mat));
  return scene;
}

function generateWallMoss() {
  const scene = new THREE.Scene();
  const tex = createDetailTexture(128, 128, 35, 55, 30, 0.55);
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -4,
  });

  const quad = new THREE.PlaneGeometry(1.0, 1.0);
  quad.translate(0, 0.5, 0);
  scene.add(new THREE.Mesh(quad, mat));
  return scene;
}

function generateHearthScorch() {
  const scene = new THREE.Scene();
  const tex = createDetailTexture(128, 128, 20, 18, 15, 0.5);
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -4,
  });

  const quad = new THREE.PlaneGeometry(2.0, 1.5);
  quad.translate(0, 0.75, 0);
  scene.add(new THREE.Mesh(quad, mat));
  return scene;
}

function generateTableStain() {
  const scene = new THREE.Scene();
  const tex = createDetailTexture(64, 64, 60, 30, 25, 0.6);
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -4,
  });

  const quad = new THREE.PlaneGeometry(0.4, 0.4);
  quad.rotateX(-Math.PI / 2);
  quad.translate(0, 0.005, 0);
  scene.add(new THREE.Mesh(quad, mat));
  return scene;
}

function generateAlePuddle() {
  const scene = new THREE.Scene();
  // Amber-brown translucent puddle on floor
  const tex = createDetailTexture(128, 128, 80, 55, 25, 0.55);
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, opacity: 0.7,
    polygonOffset: true, polygonOffsetFactor: -4,
  });

  const quad = new THREE.PlaneGeometry(0.6, 0.5);
  quad.rotateX(-Math.PI / 2);
  quad.translate(0, 0.005, 0);
  scene.add(new THREE.Mesh(quad, mat));
  return scene;
}

function generateBoneScrap() {
  const scene = new THREE.Scene();
  const boneMat = new THREE.MeshStandardMaterial({
    color: 0xD2C5A0, roughness: 0.85, metalness: 0.0,
  });

  // Small gnawed bone — cylinder shaft with knobby ends
  const shaft = new THREE.CylinderGeometry(0.02, 0.018, 0.15, 6);
  shaft.rotateZ(Math.PI / 2);
  const knob1 = new THREE.SphereGeometry(0.03, 6, 4);
  knob1.translate(-0.075, 0, 0);
  const knob2 = new THREE.SphereGeometry(0.025, 6, 4);
  knob2.translate(0.075, 0, 0);

  const merged = mergeGeometries([shaft, knob1, knob2]);
  merged.translate(0, 0.02, 0);
  scene.add(new THREE.Mesh(merged, boneMat));
  return scene;
}

function generateWaxDrip() {
  const scene = new THREE.Scene();
  // Off-white/cream solidified wax puddle
  const tex = createDetailTexture(64, 64, 200, 190, 155, 0.58);
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -4,
  });

  const quad = new THREE.PlaneGeometry(0.3, 0.3);
  quad.rotateX(-Math.PI / 2);
  quad.translate(0, 0.005, 0);
  scene.add(new THREE.Mesh(quad, mat));
  return scene;
}

// ─── Prop Catalog ────────────────────────────────────────────────────

const PROP_CATALOG = [
  // Architectural
  { name: 'ironwood-column', generate: generateColumn },
  { name: 'stone-hearth', generate: generateHearth },
  { name: 'raised-dais', generate: generateDais },
  // Furniture (large)
  { name: 'ironwood-throne', generate: generateThrone },
  { name: 'long-table', generate: generateTable },
  { name: 'bench', generate: generateBench },
  { name: 'high-seat', generate: generateHighSeat },
  { name: 'chair', generate: generateChair },
  { name: 'wooden-chest', generate: generateChest },
  // Lighting fixtures
  { name: 'iron-chandelier', generate: generateChandelier },
  { name: 'wall-sconce', generate: generateSconce },
  { name: 'candelabra', generate: generateCandelabra },
  // Decorative
  { name: 'banner', generate: generateBanner },
  { name: 'tapestry', generate: generateTapestry },
  { name: 'weapon-rack', generate: generateWeaponRack },
  // Tabletop items
  { name: 'goblet', generate: generateGoblet },
  { name: 'plate', generate: generatePlate },
  { name: 'food-platter', generate: generateFoodPlatter },
  // Floor items
  { name: 'fur-rug', generate: generateFurRug },
  { name: 'rushes', generate: generateRushes },
  { name: 'hound-sleeping', generate: generateHound },
  // Surface detail quads
  { name: 'floor-crack', generate: generateFloorCrack },
  { name: 'wall-moss', generate: generateWallMoss },
  { name: 'hearth-scorch', generate: generateHearthScorch },
  { name: 'table-stain', generate: generateTableStain },
  { name: 'ale-puddle', generate: generateAlePuddle },
  { name: 'bone-scrap', generate: generateBoneScrap },
  { name: 'wax-drip', generate: generateWaxDrip },
];

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log(`Generating ${PROP_CATALOG.length} Ironrath Great Hall props...`);
  console.log(`Output: ${OUTPUT_DIR}\n`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let totalSize = 0;
  const results = [];

  for (const prop of PROP_CATALOG) {
    try {
      const scene = prop.generate();
      const outPath = path.join(OUTPUT_DIR, `${prop.name}.glb`);
      const size = await exportGLB(scene, outPath);
      disposeScene(scene);
      global.gc?.();

      const kb = (size / 1024).toFixed(1);
      console.log(`  ${prop.name.padEnd(20)} ${kb.padStart(8)} KB`);
      totalSize += size;
      results.push({ name: prop.name, size });
    } catch (err) {
      console.error(`  FAILED: ${prop.name} — ${err.message}`);
      process.exit(1);
    }
  }

  console.log(`\nDone! ${results.length} props generated.`);
  console.log(`Total size: ${(totalSize / 1024).toFixed(1)} KB`);

  // Size budget check
  const overBudget = results.filter(r => r.size > 100 * 1024);
  if (overBudget.length > 0) {
    console.warn(`\nWARNING: ${overBudget.length} props exceed 100 KB budget:`);
    overBudget.forEach(r => console.warn(`  ${r.name}: ${(r.size / 1024).toFixed(1)} KB`));
  }
}

main();
