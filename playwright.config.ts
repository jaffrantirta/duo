import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.test.local", quiet: true });

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  timeout: 60_000,
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "mobile-chrome", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      BETTER_AUTH_URL: baseURL,
      BETTER_AUTH_SECRET: "e2e-only-secret-not-used-anywhere-else-123",
      EMAIL_TRANSPORT: "file",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
    },
  },
});
