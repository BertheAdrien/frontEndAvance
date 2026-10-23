/** Niveau 5 (Secrets) : « Le coffre qui fuit » — service isolé, aucun vrai secret du site. */

/** Configuration que le serveur envoie au navigateur. En mode vulnérable, elle livre une clé par erreur. */
export interface VaultConfig {
  appName: string;
  apiBaseUrl: string;
  features: { leaderboard: boolean; push: boolean };
  /** VULNERABLE (démo) : « clé analytics » livrée au navigateur en mode vulnérable — c'est le flag. */
  analyticsKey?: string;
}

/** Réponse de `GET /api/coffre-qui-fuit/config`. */
export interface VaultConfigResponse {
  config: VaultConfig;
  /** Vrai si une clé a fuité dans cette configuration (mode vulnérable). */
  leaked: boolean;
}

/** Un commit de l'historique Git simulé, tel que le montrerait `git log -p`. */
export interface GitCommit {
  hash: string;
  author: string;
  date: string;
  subject: string;
  /** Lignes du diff, préfixées « + » (ajout), « - » (retrait) ou « &nbsp; » (contexte). */
  diff: string[];
}

/** Détection simulée d'un scan gitleaks sur l'historique. */
export interface GitleaksFinding {
  rule: string;
  commit: string;
  file: string;
  secret: string;
}

/** Réponse de `GET /api/coffre-qui-fuit/historique-git`. */
export interface GitHistoryResponse {
  commits: GitCommit[];
  /** Détection gitleaks : présente en mode vulnérable (le secret est resté dans l'historique). */
  gitleaks: GitleaksFinding | null;
  /** Vrai si l'historique contient encore un secret (mode vulnérable). */
  leaked: boolean;
}
