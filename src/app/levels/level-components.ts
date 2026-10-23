import type { Type } from '@angular/core';

/**
 * Composant propre à chaque niveau, chargé à la demande. Il reçoit les entrées
 * `level` (PublicLevel) et `mode` (LevelMode) ; le mode fait foi côté serveur.
 * Ajouter ici chaque niveau au fur et à mesure des étapes.
 */
const LEVEL_COMPONENTS: Record<string, () => Promise<Type<unknown>>> = {
  'recherche-bavarde': () => import('./search-engine/search-level').then((m) => m.SearchLevel),
  'livre-d-or': () => import('./guestbook/guestbook-level').then((m) => m.GuestbookLevel),
  'mur-invisible': () => import('./csp-wall/csp-level').then((m) => m.CspLevel),
  'virement-fantome': () => import('./bank/bank-level').then((m) => m.BankLevel),
};

export function loadLevelComponent(levelId: string): Promise<Type<unknown>> {
  const loader = LEVEL_COMPONENTS[levelId] ?? (() => import('./level-placeholder').then((m) => m.LevelPlaceholder));
  return loader();
}
