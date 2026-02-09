import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual',
  outputDir: './tests/visual/test-results',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173/',
    viewport: { width: 1920, height: 1080 },
    launchOptions: {
      args: ['--use-gl=angle'],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  // Expect dev server to be running — don't auto-start
  webServer: undefined,
});
