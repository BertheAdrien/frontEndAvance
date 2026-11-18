import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { defineConfig, devices } from '@playwright/test';

const PORT = 4300;

/**
 * E2E sur le serveur de production buildé (`npm run test:e2e` lance `vite build` avant).
 * Fichiers `*.e2e.ts` : Vitest ne les ramasse pas (il cible `*.spec.ts`).
 * Chaque test ouvre un contexte navigateur neuf, donc un joueur neuf (cookie `ba_player`).
 */
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    locale: 'fr-FR',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node dist/analog/server/index.mjs',
    url: `http://localhost:${PORT}/classement`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      PORT: String(PORT),
      // Valeur jetable propre aux tests, pas un secret : les flags sont lus dans la page.
      FLAG_SECRET: 'e2e-only',
      BREACH_VULNERABLE_MODE: 'true',
      // Cookies sans `Secure` : le serveur de test est en HTTP.
      NODE_ENV: 'development',
      // Base neuve à chaque lancement.
      DATABASE_PATH: join(tmpdir(), `breach-e2e-${Date.now()}.db`),
    },
  },
});
