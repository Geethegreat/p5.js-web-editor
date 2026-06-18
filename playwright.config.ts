import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/playwright',
  testMatch: '**/*.spec.ts',
  timeout: 120_000,
  globalTeardown: './tests/playwright/global.teardown.ts',
  use: {
    baseURL: 'http://localhost:8000'
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
