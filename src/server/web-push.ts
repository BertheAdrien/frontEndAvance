import webpush from 'web-push';

import type { PublicLevel } from '../shared/level';
import { useDatabase } from './db';
import { notifyPlayer, type PushSender, readVapidConfig } from './push';

let sender: PushSender | null | undefined;

/** Expéditeur web-push signé avec les clés VAPID de l'environnement ; `null` si elles manquent. */
export function usePushSender(): PushSender | null {
  if (sender !== undefined) return sender;
  const vapid = readVapidConfig(process.env);
  sender = vapid
    ? (subscription, payload) =>
        webpush.sendNotification(subscription, payload, {
          vapidDetails: vapid,
          TTL: 60 * 60,
        })
    : null;
  return sender;
}

/** Notification « nouveau niveau débloqué », envoyée sans faire attendre la réponse au joueur. */
export function notifyUnlockedLevels(playerId: string, unlocked: PublicLevel[]): void {
  const send = usePushSender();
  if (!send) return;
  for (const level of unlocked) {
    notifyPlayer(
      useDatabase(),
      playerId,
      { title: 'Nouveau niveau débloqué', body: `Niveau ${level.order} : ${level.title}`, url: `/niveaux/${level.id}` },
      send,
    ).catch((error) => console.error('Notification push impossible', error));
  }
}
