import { defineConfig, devices } from "@playwright/test";

const BACKEND_PORT = 5100;
const FRONTEND_PORT = 3000;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "npm run e2e:server",
      cwd: "../backend",
      url: `http://localhost:${BACKEND_PORT}/api/v1/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: {
        PORT: String(BACKEND_PORT),
        FRONTEND_ORIGIN: `http://localhost:${FRONTEND_PORT}`,
      },
    },
    {
      command: "npm run dev -- --port 3000",
      cwd: "../frontend",
      url: `http://localhost:${FRONTEND_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      env: {
        API_INTERNAL_URL: `http://localhost:${BACKEND_PORT}/api/v1`,
        NEXT_PUBLIC_API_BASE_URL: `http://localhost:${BACKEND_PORT}/api/v1`,
        MEDIA_PUBLIC_ORIGIN: `http://localhost:${BACKEND_PORT}`,
      },
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});