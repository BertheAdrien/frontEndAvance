/** Niveau 3 (CSP) : la CSP rejouée sur le livre d'or du niveau 2. */

/** CSP posée sur la page du niveau : aucune, en rapport seul, ou bloquante. */
export type CspMode = 'none' | 'report-only' | 'enforce';

/** Violation signalée par le navigateur à l'endpoint `report-uri`. */
export interface CspViolation {
  /** `enforce` : la ressource a été bloquée ; `report` : seulement signalée. */
  disposition: 'enforce' | 'report';
  directive: string;
  blockedUri: string;
}

/** Réponse de `GET`/`POST /api/mur-invisible/csp`. */
export interface CspStateResponse {
  csp: CspMode;
  /** En-tête posé sur la page du niveau (`null` sans CSP). */
  header: { name: string; value: string } | null;
}

/** Réponse de `GET /api/mur-invisible/violations` ; le flag tombe à la première violation bloquée. */
export interface ViolationsResponse {
  violations: CspViolation[];
  flag?: string;
}
