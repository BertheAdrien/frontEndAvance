import type { DatabaseSync } from 'node:sqlite';
import { createError, defineEventHandler, readBody, setResponseStatus } from 'h3';
import { z } from 'zod';

import { getPlayerId } from './player';
import { deletePushSubscription, pushSubscriptionSchema, savePushSubscription } from './push';

/** `POST /api/push/abonnement` : rattache l'abonnement push du navigateur au joueur. */
export function createSubscribeHandler(deps: { db: () => DatabaseSync }) {
  return defineEventHandler(async (event) => {
    const parsed = pushSubscriptionSchema.safeParse(await readBody(event).catch(() => undefined));
    if (!parsed.success) throw createError({ statusCode: 400, message: 'Abonnement push invalide' });

    savePushSubscription(deps.db(), getPlayerId(event), parsed.data);
    setResponseStatus(event, 201);
    return null;
  });
}

const unsubscribeSchema = z.object({ endpoint: z.string().max(1000) });

/** `DELETE /api/push/abonnement` : le joueur ne peut retirer que ses propres abonnements. */
export function createUnsubscribeHandler(deps: { db: () => DatabaseSync }) {
  return defineEventHandler(async (event) => {
    const parsed = unsubscribeSchema.safeParse(await readBody(event).catch(() => undefined));
    if (!parsed.success) throw createError({ statusCode: 400, message: 'Abonnement push invalide' });

    deletePushSubscription(deps.db(), getPlayerId(event), parsed.data.endpoint);
    setResponseStatus(event, 204);
    return null;
  });
}
