import type { H3Event } from 'h3';
import { createError, getCookie, readBody, setCookie } from 'h3';
import { z } from 'zod';

import type { LevelMode } from '../shared/level';

export const MODE_COOKIE = 'ba_mode';

const modeSchema = z.enum(['vulnerable', 'secure']);
const changeModeSchema = z.object({ mode: modeSchema });

/** Le mode vulnérable n'existe que si l'environnement l'autorise explicitement. */
export function isVulnerableModeEnabled(): boolean {
  return process.env['BREACH_VULNERABLE_MODE'] === 'true';
}

/**
 * Mode demandé par le joueur (cookie), lu côté serveur par chaque niveau.
 * Mode vulnérable désactivé : toujours « secure », quel que soit le cookie.
 */
export function getLevelMode(event: H3Event, enabled = isVulnerableModeEnabled()): LevelMode {
  if (!enabled) return 'secure';
  const parsed = modeSchema.safeParse(getCookie(event, MODE_COOKIE));
  return parsed.success ? parsed.data : 'vulnerable';
}

export async function changeLevelMode(event: H3Event, enabled = isVulnerableModeEnabled()): Promise<{ mode: LevelMode }> {
  const parsed = changeModeSchema.safeParse(await readBody(event));
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Mode invalide' });

  const { mode } = parsed.data;
  if (mode === 'vulnerable' && !enabled) {
    throw createError({ statusCode: 403, message: 'Mode vulnérable désactivé sur ce serveur' });
  }

  setCookie(event, MODE_COOKIE, mode, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env['NODE_ENV'] === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return { mode };
}
