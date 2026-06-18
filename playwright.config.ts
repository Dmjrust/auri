import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // SPA com Supabase: sem DB isolation, evitar paralelo
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 30_000,

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    // 1. Setup: faz login e salva sessão
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // 2. Smoke tests — sem auth (verifica estrutura básica da SPA)
    {
      name: 'smoke',
      testMatch: /smoke\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    // 3. Testes autenticados — médico logado
    {
      name: 'authenticated',
      testMatch: /e2e\/.+\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/doctor.json',
      },
      dependencies: ['setup'],
    },
  ],
});
