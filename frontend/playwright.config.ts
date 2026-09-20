import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Browser tests for the CMS. They run the real API (backend/e2e_server.py: a brand-new SQLite file
 * in a temporary folder, never the database in backend/.env) and the real CMS against it.
 *
 *   npm run e2e            headless
 *   npm run e2e -- --ui    with Playwright's runner, to watch and step through
 */
const API_PORT = 8010;
const WEB_PORT = 5183;

const backend = join(import.meta.dirname, "..", "backend");
const venvPython = join(backend, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const python = process.env.E2E_PYTHON ?? (existsSync(venvPython) ? venvPython : "python");

export default defineConfig({
  testDir: "./e2e",
  // One story told in order against one database: accounts are created, then used.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  // No retries: the tests share one database, so re-running an early one after later ones have
  // changed it (the first administrator already exists) can only fail for the wrong reason.
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
  },
  webServer: [
    {
      command: `"${python}" e2e_server.py ${API_PORT}`,
      cwd: backend,
      url: `http://127.0.0.1:${API_PORT}/ready`,
      // Never reuse: a leftover server would carry the last run's accounts.
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort --host 127.0.0.1`,
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
      // Wins over .env and .env.local, so the CMS under test can only ever talk to the test API.
      env: { VITE_API_URL: `http://127.0.0.1:${API_PORT}/api/v1`, VITE_ADMIN_API_KEY: "" },
    },
  ],
});
