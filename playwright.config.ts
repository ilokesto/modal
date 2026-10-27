import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Keep browser reporting from modifying the migration history checkout.
  captureGitInfo: { diff: false },
  testDir: './tests/browser',
  testMatch: ['**/*.e2e.ts', '**/*.a11y.ts'],
  timeout: 30_000,
  workers: 2,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm exec vite --config tests/browser/vite.config.ts --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
