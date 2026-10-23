/** Niveau 4 (CSRF) : une fausse banque isolée, avec sa propre session `ba_bank`. */

/** Reçu d'un virement, tel qu'affiché dans l'historique du compte. */
export interface TransferReceipt {
  beneficiaire: string;
  montant: number;
  date: string;
  /** Vrai si le virement a été déclenché par une requête frauduleuse (CSRF). */
  frauduleux: boolean;
}

/** Réponse de `GET /api/virement-fantome/compte`. */
export interface AccountResponse {
  solde: number;
  historique: TransferReceipt[];
  /** Présent dès qu'un virement frauduleux a eu lieu dans cette session. */
  flag?: string;
}

/** Réponse JSON de `POST /api/virement-fantome/virement` (virement légitime). */
export interface TransferResponse {
  recu: TransferReceipt;
  solde: number;
  flag?: string;
}
