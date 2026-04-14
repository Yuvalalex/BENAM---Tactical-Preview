// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const PORT = process.env.PORT || '8080';
const BASE_URL = `http://127.0.0.1:${PORT}`;

module.exports = defineConfig({
  testDir: './tests',
  timeout: 20000,
  retries: 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'test-report', open: 'never' }],
    ['list']
  ],
  use: {
    baseURL: BASE_URL,
    headless: true,
    bypassCSP: true,
    locale: 'he-IL',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: {
    command: `npx vite --port ${PORT} --host 0.0.0.0`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 60000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
