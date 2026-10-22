import { randomUUID } from 'node:crypto';
import type { H3Event } from 'h3';
import { getCookie, setCookie } from 'h3';

export const PLAYER_COOKIE = 'ba_player';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Identifie le joueur anonyme par un cookie ; en crée un s'il est absent ou invalide. */
export function getPlayerId(event: H3Event): string {
  const existing = getCookie(event, PLAYER_COOKIE);
  if (existing && UUID.test(existing)) return existing;

  const id = randomUUID();
  setCookie(event, PLAYER_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env['NODE_ENV'] === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return id;
}
