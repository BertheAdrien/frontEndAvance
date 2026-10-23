/** Classement public des joueurs ayant choisi un pseudonyme. */

export interface LeaderboardEntry {
  rank: number;
  pseudonym: string;
  /** Nombre de niveaux capturés. */
  captured: number;
  /** Date ISO (UTC) de la dernière capture, qui départage les ex aequo ; `null` si aucune. */
  lastCaptureAt: string | null;
}

/** Réponse de `GET /api/classement`. */
export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  /** Instant où le classement a été calculé (révèle l'âge d'une page pré-rendue). */
  generatedAt: string;
}

/** Réponse de `GET`/`POST /api/classement/pseudo`. */
export interface PseudonymResponse {
  pseudonym: string | null;
}

/** Règle partagée client/serveur : 3 à 20 lettres, chiffres, `_` ou `-`. */
export const PSEUDONYM_PATTERN = /^[\p{L}\p{N}_-]{3,20}$/u;
