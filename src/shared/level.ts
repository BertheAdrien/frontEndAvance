/** Types partagés entre le serveur Nitro et l'application Angular. */

export type LevelTheme = 'XSS' | 'XSS stockée' | 'CSP' | 'CSRF' | 'Secrets' | 'IA';

export type LevelStatus = 'captured' | 'available' | 'locked';

/** Mode de jeu d'un niveau ; « vulnerable » n'existe que si `BREACH_VULNERABLE_MODE=true`. */
export type LevelMode = 'vulnerable' | 'secure';

/** Vue d'un niveau envoyée au navigateur : sans flag. */
export interface PublicLevel {
  id: string;
  order: number;
  theme: LevelTheme;
  title: string;
  summary: string;
  instructions: string;
  story: string;
  status: LevelStatus;
}

/** Réponse de `POST /api/levels/:id/flag` (les cas d'erreur passent par le code HTTP). */
export interface FlagSubmissionResponse {
  result: 'captured' | 'wrong';
  levels: PublicLevel[];
}
