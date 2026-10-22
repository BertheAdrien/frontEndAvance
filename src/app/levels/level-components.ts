import type { Type } from '@angular/core';

/**
 * Composant propre à chaque niveau, chargé à la demande. Il reçoit les entrées
 * `level` (PublicLevel) et `mode` (LevelMode) ; le mode fait foi côté serveur.
 * Ajouter ici chaque niveau au fur et à mesure des étapes.
 */
const LEVEL_COMPONENTS: Record<string, () => Promise<Type<unknown>>> = {};

export function loadLevelComponent(levelId: string): Promise<Type<unknown>> {
  const loader = LEVEL_COMPONENTS[levelId] ?? (() => import('./level-placeholder').then((m) => m.LevelPlaceholder));
  return loader();
}
