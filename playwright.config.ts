import { defineConfig, devices } from "@playwright/test";
import type { PlaywrightTestConfig } from "@playwright/test";

/** Port the e2e server listens on, away from the default dev port 3000 */
const PORT = Number(process.env.E2E_PORT ?? 3100);

/** Origin the tests load the demo from */
const BASE_URL = `http://localhost:${PORT}`;

/** Port the Base UI fixture app (built by tools/scripts/base-ui-fixture.sh) listens on */
const BASE_UI_PORT = Number(process.env.E2E_BASE_UI_PORT ?? 3200);

/** Origin the base-ui project loads the fixture app from */
const BASE_UI_URL = `http://localhost:${BASE_UI_PORT}`;

/** One server of the config's `webServer` list */
type WebServer = Extract<
  NonNullable<PlaywrightTestConfig["webServer"]>,
  unknown[]
>[number];

/** Projects picked with `--project` on the command line */
const PICKED_PROJECTS = process.argv.flatMap((arg, index, args) => {
  if (arg === "--project") return [args[index + 1]];
  if (arg.startsWith("--project=")) return [arg.slice("--project=".length)];
  return [];
});

/**
 * Whether a project runs: picked with `--project`, or every project when
 * none is. Playwright starts every `webServer` whichever projects run, so each
 * server is listed only when its project runs.
 */
function runsProject(name: string): boolean {
  return PICKED_PROJECTS.length === 0 || PICKED_PROJECTS.includes(name);
}

/** Builds and serves the demo at `/` for the chromium project */
const DEMO_SERVER: WebServer = {
  command: `pnpm build && pnpm start --port ${PORT}`,
  url: BASE_URL,
  reuseExistingServer: !process.env.CI,
  timeout: 180_000,
  stdout: "ignore",
  stderr: "pipe",
};

/** Serves the Base UI fixture app, built beforehand, for the base-ui project */
const BASE_UI_SERVER: WebServer = {
  command: `bash tools/scripts/base-ui-fixture.sh start ${BASE_UI_PORT}`,
  url: BASE_UI_URL,
  reuseExistingServer: !process.env.CI,
  timeout: 60_000,
  stdout: "ignore",
  stderr: "pipe",
};

/**
 * End-to-end regression suite and unit tests.
 *
 * `chromium` drives the demo at `/`, against a production build (`next build`
 * + `next start`) so the dev-only overlays (Next.js indicator, Agentation
 * toolbar) never sit on top of the calendar. `base-ui` drives the registry
 * installed in a shadcn/ui project set up with Base UI (e2e/base-ui/), which
 * `pnpm test:e2e:base-ui` builds first. Locally, a server already running on
 * a project's port is reused.
 *
 * `unit` runs the tests in unit/ that need no page (repeat rules, .ics,
 * range math). It starts no server and no browser.
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
      testIgnore: "base-ui/**",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "base-ui",
      testDir: "./e2e/base-ui",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        baseURL: BASE_UI_URL,
      },
    },
    {
      name: "unit",
      testDir: "./unit",
    },
  ],
  webServer: [
    ...(runsProject("chromium") ? [DEMO_SERVER] : []),
    ...(runsProject("base-ui") ? [BASE_UI_SERVER] : []),
  ],
});
