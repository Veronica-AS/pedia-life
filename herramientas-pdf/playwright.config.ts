import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas de punta a punta contra la versión compilada (incluye Worker, PWA y prerenderizado).
 * Por defecto: Chromium escritorio y celular. Con ALL_BROWSERS=1 también Firefox y WebKit (motor de Safari),
 * si están instalados (`npx playwright install firefox webkit`).
 */
const all = process.env.ALL_BROWSERS === '1';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    acceptDownloads: true,
    locale: 'es-MX',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'celular', use: { ...devices['Pixel 7'] } },
    ...(all
      ? [
          { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
          { name: 'webkit', use: { ...devices['Desktop Safari'] } },
          { name: 'iphone', use: { ...devices['iPhone 14'] } },
        ]
      : []),
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
