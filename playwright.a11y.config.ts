import { defineConfig, devices } from "@playwright/test";

// Accessibility scan of the BUILT app (npm run build first), served locally with
// the Supabase API answered by stubs inside the tests. Nothing here reaches
// production. The default playwright.config.ts (production base URL, ./tests)
// is left as it was.
const PORT = 4173;

export default defineConfig({
  testDir: "./tests/a11y",
  timeout: 60_000,
  retries: 0,
  workers: 2,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
