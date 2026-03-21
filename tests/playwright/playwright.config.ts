import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/playwright',
  testMatch: '**/*.spec.ts',
  testIgnore: ['**/client/**', '**/server/**', '**/node_modules/**'],
  timeout: 30000,

  // Stop Playwright from transforming files outside testDir
  transform: {},

  use: {
    baseURL: 'http://localhost:8000',
    headless: false
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
