/** Livre d'or du niveau 2 (XSS stockée). Service isolé du reste du site. */

export interface GuestbookMessage {
  id: number;
  author: string;
  /** Contenu saisi par le joueur. En mode vulnérable, stocké tel quel (payload compris). */
  body: string;
  createdAt: string;
}

/** Réponse de `GET`/`POST /api/livre-d-or/messages`. */
export interface GuestbookResponse {
  messages: GuestbookMessage[];
}

/** Butin récupéré par le faux collecteur de l'attaquant (`/api/evil/collect`). */
export interface LootResponse {
  loot: string[];
}
