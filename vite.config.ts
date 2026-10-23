/// <reference types="vitest" />

import { defineConfig, type Plugin, type PluginOption } from 'vite';
import analog from '@analogjs/platform';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Analog résout une config par environnement (client puis SSR) avec la même instance de
 * vite-plugin-pwa : il garderait la config SSR et ne générerait jamais le service worker.
 */
function clientConfigOnly(plugins: PluginOption[]): PluginOption[] {
  return (plugins as Plugin[]).map((plugin) => {
    const configResolved = plugin.configResolved;
    return {
      ...plugin,
      applyToEnvironment: (environment) => environment.name === 'client',
      configResolved(config) {
        if (typeof configResolved === 'function' && !config.build.ssr) return configResolved.call(this, config);
      },
    };
  });
}

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
      // Fiches de cours : Markdown converti en HTML au build (sans highlighter, les .md ne sont pas transformés).
      content: { highlighter: 'prism' },
      // Pas de pré-rendu par défaut : l'accueil dépend du joueur (SSR). Le SSG est activé route par route.
      prerender: { routes: ['/classement/ssg'] },
      // Comparaison CSR / SSR / SSG du classement : cette route est servie sans rendu serveur.
      // Fiches de cours en CSR : le service worker leur sert la même coquille HTML, hors ligne compris.
      nitro: {
        routeRules: {
          '/classement/csr': { ssr: false },
          '/fiches': { ssr: false },
          '/fiches/**': { ssr: false },
        },
      },
    }),
    tailwindcss(),
    ...clientConfigOnly(VitePWA({
      // Enregistré dans main.ts : pas de script inline injecté dans le HTML (CSP).
      injectRegister: false,
      registerType: 'autoUpdate',
      manifest: {
        name: 'Breach Academy',
        short_name: 'Breach',
        description: 'CTF pédagogique : chaque niveau est une faille web à exploiter, puis à corriger.',
        lang: 'fr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#0e1116',
        background_color: '#0e1116',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Code de l'app (fiches comprises : le Markdown est compilé dans les chunks JS) et polices latines.
        globPatterns: ['**/*.{js,css,html,ico,svg}', 'assets/*-latin-wght-normal-*.woff2'],
        // Hors ligne, seules les fiches (CSR) reçoivent la coquille ; les autres pages restent rendues par le serveur.
        navigateFallback: '/index.html',
        navigateFallbackAllowlist: [/^\/fiches(\/|$)/],
        // Réception des notifications push (public/push-sw.js).
        importScripts: ['/push-sw.js'],
      },
    })),
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
