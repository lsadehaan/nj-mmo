import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';

const baseURL = process.env['BASE_URL'] || 'http://localhost:4200';

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  // Each test joins its own isolated `town` room (see src/game-page.ts), so the
  // suite is parallel-safe — no shared-room state bleed, no serial ordering.
  fullyParallel: true,
  workers: process.env['CI'] ? 2 : 4,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command:
        'cd .. && tsx --tsconfig server/tsconfig.app.json server/src/seed/cli.ts && npx nx serve server',
      url: 'http://localhost:2567/health',
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
    },
    {
      // Serve a prebuilt client (static) rather than the dev server: the dev
      // server compiles modules on first request, and parallel cold page-loads
      // contended enough to occasionally push a test toward its timeout. A
      // prebuilt preview serves instantly and deterministically.
      command: 'npx nx run client:preview',
      url: 'http://localhost:4200',
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
