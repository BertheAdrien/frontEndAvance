/// <reference types="vitest" />

import { defineConfig } from 'vite';
import analog from '@analogjs/platform';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig(() => ({
  build: {
    target: ['es2020'],
  },
  resolve: {
    mainFields: ['module'],
  },
  plugins: [
    analog({
      // Pas de pré-rendu par défaut : l'accueil dépend du joueur (SSR). Le SSG est activé route par route.
      prerender: { routes: ['/classement/ssg'] },
      // Comparaison CSR / SSR / SSG du classement : cette route est servie sans rendu serveur.
      nitro: { routeRules: { '/classement/csr': { ssr: false } } },
    }),
    tailwindcss()
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['**/*.spec.ts'],
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/main*.ts', 'src/test-setup.ts', 'src/vite-env.d.ts', 'src/app/app.config*.ts'],
      // Plancher indicatif (voir CLAUDE.md et le skill tdd) : ne pas écrire de tests juste pour l'atteindre.
      thresholds: { lines: 40 },
    },
  },
}));
