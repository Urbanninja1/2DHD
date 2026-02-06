import * as THREE from 'three';

/**
 * Creates procedural placeholder textures for development.
 * These replace asset loading until real assets are sourced.
 */

function createCanvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
  nearest = false,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  draw(ctx);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (nearest) {
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
  }
  return tex;
}

let _floorTexture: THREE.CanvasTexture | null = null;

/** Stone floor — dark gray tiles with subtle grid lines. Cached; cloned on repeat calls. */
export function createStoneFloorTexture(): THREE.CanvasTexture {
  if (_floorTexture) return _floorTexture.clone();
  _floorTexture = createCanvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, 0, 256, 256);

    // Tile grid
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 64, 0);
      ctx.lineTo(i * 64, 256);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * 64);
      ctx.lineTo(256, i * 64);
      ctx.stroke();
    }

    // Subtle noise
    for (let i = 0; i < 500; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const v = 50 + Math.random() * 20;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return _floorTexture;
}

let _wallTexture: THREE.CanvasTexture | null = null;

/** Stone wall — lighter gray with mortar lines. Cached; cloned on repeat calls. */
export function createStoneWallTexture(): THREE.CanvasTexture {
  if (_wallTexture) return _wallTexture.clone();
  _wallTexture = createCanvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#4a4540';
    ctx.fillRect(0, 0, 256, 256);

    // Brick pattern
    ctx.strokeStyle = '#3a352f';
    ctx.lineWidth = 2;
    const bh = 32;
    const bw = 64;
    for (let row = 0; row < 8; row++) {
      const y = row * bh;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();

      const offset = row % 2 === 0 ? 0 : bw / 2;
      for (let col = 0; col < 5; col++) {
        const x = offset + col * bw;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + bh);
        ctx.stroke();
      }
    }

    // Subtle noise
    for (let i = 0; i < 600; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const v = 60 + Math.random() * 25;
      ctx.fillStyle = `rgb(${v},${v - 5},${v - 10})`;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return _wallTexture;
}

/** Pixel-art player sprite — 16x16 knight-like character */
export function createPlayerSpriteTexture(): THREE.CanvasTexture {
  return createCanvasTexture(16, 16, (ctx) => {
    ctx.imageSmoothingEnabled = false;

    // Transparent background
    ctx.clearRect(0, 0, 16, 16);

    // Body (armor gray)
    ctx.fillStyle = '#8899aa';
    ctx.fillRect(5, 5, 6, 7);

    // Head
    ctx.fillStyle = '#e8c8a0';
    ctx.fillRect(6, 2, 4, 4);

    // Helmet
    ctx.fillStyle = '#667788';
    ctx.fillRect(6, 1, 4, 2);

    // Eyes
    ctx.fillStyle = '#333333';
    ctx.fillRect(7, 3, 1, 1);
    ctx.fillRect(9, 3, 1, 1);

    // Legs
    ctx.fillStyle = '#556677';
    ctx.fillRect(6, 12, 2, 3);
    ctx.fillRect(9, 12, 2, 3);

    // Feet
    ctx.fillStyle = '#443322';
    ctx.fillRect(5, 14, 3, 2);
    ctx.fillRect(8, 14, 3, 2);

    // Sword
    ctx.fillStyle = '#ccccdd';
    ctx.fillRect(11, 4, 1, 8);
    ctx.fillStyle = '#aa8844';
    ctx.fillRect(11, 8, 1, 2);
  }, true);
}

/** Pixel-art NPC sprite — 16x16 generic figure */
export function createNPCSpriteTexture(color: string): THREE.CanvasTexture {
  return createCanvasTexture(16, 16, (ctx) => {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 16, 16);

    // Body
    ctx.fillStyle = color;
    ctx.fillRect(5, 5, 6, 7);

    // Head
    ctx.fillStyle = '#e8c8a0';
    ctx.fillRect(6, 2, 4, 4);

    // Eyes
    ctx.fillStyle = '#333333';
    ctx.fillRect(7, 3, 1, 1);
    ctx.fillRect(9, 3, 1, 1);

    // Legs
    ctx.fillStyle = '#444444';
    ctx.fillRect(6, 12, 2, 3);
    ctx.fillRect(9, 12, 2, 3);

    // Feet
    ctx.fillStyle = '#443322';
    ctx.fillRect(5, 14, 3, 2);
    ctx.fillRect(8, 14, 3, 2);
  }, true);
}
