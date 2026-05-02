import { defineConfig, devices } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const serverPort = 4100;
const webPort = 4173;
const e2eDbFile = join(mkdtempSync(join(tmpdir(), "workboard-e2e-")), "workboard.sqlite");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ],
  webServer: [
    {
      command: "npm run dev:e2e --workspace server",
      url: `http://127.0.0.1:${serverPort}/api/board`,
      env: {
        NODE_ENV: "test",
        HOST: "127.0.0.1",
        PORT: String(serverPort),
        WORKBOARD_DB_FILE: e2eDbFile
      },
      reuseExistingServer: false,
      timeout: 30_000
    },
    {
      command: `npm run dev --workspace web -- --host 127.0.0.1 --port ${webPort}`,
      url: `http://127.0.0.1:${webPort}/admin`,
      env: {
        VITE_API_BASE: `http://127.0.0.1:${serverPort}`
      },
      reuseExistingServer: false,
      timeout: 30_000
    }
  ]
});
