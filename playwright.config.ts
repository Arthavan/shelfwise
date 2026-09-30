import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3000);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 1,
  forbidOnly: !!process.env.CI,
  reporter: [["list"]],
  use: { baseURL, locale: "en-US", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run db:reset && npm run build && npm run start",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? `file:./e2e-${PORT}.db`,
      DATA_DIR: process.env.E2E_DATA_DIR ?? `./e2e-data-${PORT}`,
      E2E_TEST_HOOKS: "1",
      PORT: String(PORT),
    },
  },
});
