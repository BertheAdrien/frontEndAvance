import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Icônes de la PWA générées depuis public/icon.svg : `npm run icons`.
// Fond des icônes « maskable » et Apple aux couleurs du site (blanc par défaut).
const background = '#0e1116';

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background } },
  },
  images: ['public/icon.svg'],
});
