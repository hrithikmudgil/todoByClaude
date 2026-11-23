import { defineConfig, devices } from '@playwright/test'

// End-to-end tests drive the real stack: browser -> Vite (:5173, proxies /api) -> .NET API (:5080) -> Postgres.
// Postgres must already be running (see README). By default the API uses the dev database from
// appsettings.Development.json; set E2E_DB_CONNECTION to point the tests at a throwaway database instead.
const apiEnv: Record<string, string> = { ASPNETCORE_ENVIRONMENT: 'Development' }
if (process.env.E2E_DB_CONNECTION) {
  apiEnv.ConnectionStrings__Default = process.env.E2E_DB_CONNECTION
}

export default defineConfig({
  testDir: './e2e',
  // Tests create their own uniquely-named users, but run one at a time to keep failures easy to read.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'dotnet run --project ../api/TodoApi --launch-profile http',
      url: 'http://localhost:5080/api/health',
      env: apiEnv,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
})
