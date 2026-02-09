import { test, expect } from '@playwright/test';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_DIR = join(__dirname, 'snapshots');
const LOAD_WAIT_MS = 8_000; // Wait for Three.js assets to load
const FRAME_SETTLE_MS = 500; // Wait for render to settle after camera move

interface CameraAngle {
  name: string;
  position: [number, number, number];
  target: [number, number, number];
}

const ANGLES: CameraAngle[] = [
  {
    name: 'default',
    position: [0, 18, 22],
    target: [0, 0, 0],
  },
  {
    name: 'table-closeup',
    position: [0, 8, 6],
    target: [0, 1, -1],
  },
  {
    name: 'ceiling-lights',
    position: [0, 12, 0],
    target: [0, 8, -2],
  },
];

test.describe('Great Hall Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?room=IronrathGreatHall');
    // Wait for Three.js scene to fully load
    await page.waitForTimeout(LOAD_WAIT_MS);
    // Verify __debugCamera is available
    const hasCamera = await page.evaluate(() => !!(window as any).__debugCamera);
    expect(hasCamera).toBe(true);
  });

  for (const angle of ANGLES) {
    test(`screenshot: ${angle.name}`, async ({ page }) => {
      // Move camera to the specified angle
      await page.evaluate(
        ({ pos, target }) => {
          const cam = (window as any).__debugCamera;
          cam.position.set(pos[0], pos[1], pos[2]);
          cam.lookAt(target[0], target[1], target[2]);
          cam.updateProjectionMatrix();
        },
        { pos: angle.position, target: angle.target },
      );
      await page.waitForTimeout(FRAME_SETTLE_MS);

      // Capture screenshot
      const path = join(SNAPSHOT_DIR, `great-hall-${angle.name}.png`);
      await page.screenshot({ path });
    });
  }
});
