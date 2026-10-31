import { defineConfig, devices } from "@playwright/test";

/** Port the e2e server listens on, away from the default dev port 3000 */
const PORT = Number(process.env.E2E_PORT ?? 3100);

/** Origin the tests load the demo from */
const BASE_URL = `http://localhost:${PORT}`;

/**
 * End-to-end regression suite for the demo at `/`.
 *
 * Runs against a production build (`next build` + `next start`) so the
 * dev-only overlays (Next.js indicator, Agentation toolbar) never sit on top
 * of the calendar. Locally, an e2e server already running on PORT is reused.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: BASE_URL,
    locale: "en-US",
    timezoneId: "America/New_York",
    colorScheme: "light",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
