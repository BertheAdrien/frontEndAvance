/** Notifications push « nouveau niveau débloqué ». */

/** Contenu d'une notification, lu par le service worker (`public/push-sw.js`). */
export interface PushPayload {
  title: string;
  body: string;
  /** Chemin relatif du site ouvert au clic. */
  url: string;
}

/** Réponse de `GET /api/push/cle-publique` : `null` si le serveur n'a pas de clés VAPID. */
export interface PushPublicKeyResponse {
  publicKey: string | null;
}
