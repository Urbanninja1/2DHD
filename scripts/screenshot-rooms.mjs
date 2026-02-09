import { chromium } from 'playwright';
import { setTimeout } from 'timers/promises';

// Which rooms to capture (pass 'all' or specific room numbers via CLI)
const arg = process.argv[2] || 'all';

const ALL_ROOMS = [
  { key: 'Digit1', name: '01-throne-room', label: 'Throne Room' },
  { key: 'Digit2', name: '02-antechamber', label: 'Antechamber' },
  { key: 'Digit3', name: '03-small-council', label: 'Small Council' },
  { key: 'Digit4', name: '04-hands-solar', label: "Hand's Solar" },
  { key: 'Digit5', name: '05-grand-gallery', label: 'Grand Gallery' },
  { key: 'Digit6', name: '06-guard-post', label: 'Guard Post' },
  { key: 'Digit7', name: '07-maegor-entry', label: "Maegor's Entry" },
  { key: 'Digit8', name: '08-queens-ballroom', label: "Queen's Ballroom" },
  { key: 'Digit9', name: '09-tower-stairwell', label: 'Tower Stairwell' },
  { key: 'Digit0', name: '10-battlements', label: 'Battlements' },
  // Ironrath Castle
  { key: 'KeyG', name: 'ironrath-great-hall', label: 'Ironrath Great Hall' },
];

const roomFilter = arg === 'all'
  ? null
  : new Set(arg.split(',').map(n => parseInt(n.trim(), 10)));

const ROOMS = roomFilter
  ? ALL_ROOMS.filter((_, i) => roomFilter.has(i + 1))
  : ALL_ROOMS;

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader'],
  });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`  [browser error] ${msg.text()}`);
  });

  console.log('Opening game...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

  await setTimeout(3000);
  await page.click('canvas');
  await setTimeout(5000);

  for (const room of ROOMS) {
    console.log(`Teleporting to ${room.name}...`);
    await page.keyboard.press(room.key);

    // Poll debug overlay to confirm room loaded
    let loaded = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      await setTimeout(500);
      const overlayText = await page.evaluate(() => {
        const el = document.getElementById('debug-overlay');
        return el ? el.textContent : '';
      });
      if (overlayText && overlayText.includes(room.label)) {
        loaded = true;
        await setTimeout(3000);
        break;
      }
    }

    if (!loaded) {
      console.log(`  WARNING: Room ${room.name} may not have loaded (waited 15s)`);
      await setTimeout(3000);
    }

    await page.screenshot({ path: `screenshots/${room.name}.png`, fullPage: false });
    console.log(`  Saved: screenshots/${room.name}.png`);
  }

  await browser.close();
  console.log('Done!');
}

main().catch(console.error);
