import type { DatabaseSync } from 'node:sqlite';
import { createError, defineEventHandler, getRouterParam, readBody, setResponseHeader } from 'h3';
import { z } from 'zod';

import type { FlagSubmissionResponse } from '../../shared/level';
import { getPlayerId } from '../player';
import type { RateLimiter } from '../rate-limit';
import type { Level } from './catalog';
import { getLevelsForPlayer, submitFlag } from './level.service';

const flagSchema = z.object({ flag: z.string().trim().min(1).max(200) });

/**
 * Soumission d'un flag. Les dépendances sont injectées pour tester la route avec
 * une base en mémoire ; la route Nitro passe les instances partagées.
 */
export function createFlagHandler(deps: { db: () => DatabaseSync; levels: () => Level[]; limiter: RateLimiter }) {
  return defineEventHandler(async (event): Promise<FlagSubmissionResponse> => {
    const playerId = getPlayerId(event);

    // Limitée avant toute validation : chaque tentative compte, même malformée.
    const { allowed, retryAfterSeconds } = deps.limiter.hit(playerId);
    if (!allowed) {
      setResponseHeader(event, 'Retry-After', retryAfterSeconds);
      throw createError({ statusCode: 429, message: 'Trop de tentatives, réessayez plus tard' });
    }

    const parsed = flagSchema.safeParse(await readBody(event).catch(() => undefined));
    if (!parsed.success) throw createError({ statusCode: 400, message: 'Flag invalide' });

    const db = deps.db();
    const levels = deps.levels();
    const result = submitFlag(db, levels, playerId, getRouterParam(event, 'id') ?? '', parsed.data.flag);

    if (result === 'unknown') throw createError({ statusCode: 404, message: 'Niveau inconnu' });
    if (result === 'locked') throw createError({ statusCode: 403, message: 'Niveau verrouillé' });

    return { result, levels: getLevelsForPlayer(db, levels, playerId) };
  });
}
