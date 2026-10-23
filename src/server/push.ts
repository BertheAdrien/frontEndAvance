import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';

import type { PublicLevel } from '../shared/level';
import type { PushPayload } from '../shared/push';

/**
 * Services push des navigateurs (Chrome/Edge via FCM, Firefox, Windows, Safari).
 * Le serveur envoie une requête à l'endpoint fourni par le client : sans cette liste,
 * un abonnement forgé ferait viser au serveur une adresse interne (SSRF).
 */
const PUSH_SERVICE_DOMAINS = ['fcm.googleapis.com', 'push.services.mozilla.com', 'notify.windows.com', 'push.apple.com'];

function isKnownPushService(endpoint: string): boolean {
  const url = new URL(endpoint);
  return (
    url.protocol === 'https:' &&
    PUSH_SERVICE_DOMAINS.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))
  );
}

export const pushSubscriptionSchema = z.object({
  endpoint: z.url().max(1000).refine(isKnownPushService, 'Service push inconnu'),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

export type StoredPushSubscription = z.infer<typeof pushSubscriptionSchema>;

/** Envoi effectif (web-push en production) ; rejette avec `statusCode` en cas d'échec HTTP. */
export type PushSender = (subscription: StoredPushSubscription, payload: string) => Promise<unknown>;

/** Un navigateur n'a qu'un abonnement : il est rattaché au dernier joueur qui l'a enregistré. */
export function savePushSubscription(db: DatabaseSync, playerId: string, subscription: StoredPushSubscription): void {
  db.prepare(
    `INSERT INTO push_subscriptions (endpoint, player_id, p256dh, auth) VALUES (?, ?, ?, ?)
     ON CONFLICT (endpoint) DO UPDATE SET player_id = excluded.player_id, p256dh = excluded.p256dh, auth = excluded.auth`,
  ).run(subscription.endpoint, playerId, subscription.keys.p256dh, subscription.keys.auth);
}

export function deletePushSubscription(db: DatabaseSync, playerId: string, endpoint: string): boolean {
  const { changes } = db
    .prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND player_id = ?')
    .run(endpoint, playerId);
  return changes > 0;
}

/** Envoie la notification à chaque navigateur du joueur ; oublie ceux que le service push déclare expirés. */
export async function notifyPlayer(db: DatabaseSync, playerId: string, payload: PushPayload, send: PushSender) {
  const rows = db
    .prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE player_id = ?')
    .all(playerId) as { endpoint: string; p256dh: string; auth: string }[];
  const body = JSON.stringify(payload);

  await Promise.all(
    rows.map(async ({ endpoint, p256dh, auth }) => {
      try {
        await send({ endpoint, keys: { p256dh, auth } }, body);
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
        }
      }
    }),
  );
}

/** Niveaux déverrouillés par une capture (verrouillés avant, accessibles après). */
export function newlyUnlockedLevels(before: PublicLevel[], after: PublicLevel[]): PublicLevel[] {
  const wasLocked = new Set(before.filter((l) => l.status === 'locked').map((l) => l.id));
  return after.filter((l) => l.status !== 'locked' && wasLocked.has(l.id));
}

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

/** Clés VAPID lues à l'exécution ; sans les trois variables, les notifications sont désactivées. */
export function readVapidConfig(env: Record<string, string | undefined>): VapidConfig | null {
  const publicKey = env['VAPID_PUBLIC_KEY'];
  const privateKey = env['VAPID_PRIVATE_KEY'];
  const subject = env['VAPID_SUBJECT'];
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}
