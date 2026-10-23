import type { ContentFile } from '@analogjs/content';

/** En-tête (front matter) d'une fiche de cours `src/content/fiches/*.md`. */
export interface FicheAttributes {
  title: string;
  /** Ordre du niveau associé. */
  order: number;
  /** Identifiant du niveau qui illustre la faille. */
  level: string;
  summary: string;
}

// Les fichiers Markdown de ce dossier sont aussi des routes (/fiches/<slug>) : voir pages/fiches.page.ts.
export const isFiche = (file: ContentFile<FicheAttributes | Record<string, never>>): boolean =>
  // Chemin relatif au projet, avec ou sans « / » initial selon la version d'Analog.
  file.filename.includes('src/content/fiches/');
