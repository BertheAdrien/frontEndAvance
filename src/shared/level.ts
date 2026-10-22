/** Types partagés entre le serveur Nitro et l'application Angular. */

export type LevelTheme = 'XSS' | 'XSS stockée' | 'CSP' | 'CSRF' | 'Secrets' | 'IA';

export type LevelStatus = 'captured' | 'available' | 'locked';

/** Vue d'un niveau envoyée au navigateur : sans flag. */
export interface PublicLevel {
  id: string;
  order: number;
  theme: LevelTheme;
  title: string;
  summary: string;
  story: string;
  status: LevelStatus;
}
