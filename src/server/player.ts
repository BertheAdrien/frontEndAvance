import { randomUUID } from 'node:crypto';
import type { H3Event } from 'h3';
import { getCookie, setCookie } from 'h3';

export const PLAYER_COOKIE = 'ba_player';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Identifie le joueur anonyme par un cookie ; en crée un s'il est absent ou invalide.
 * Le nouvel identifiant est aussi recopié dans le cookie de la requête : la suite du
 * traitement (rendu SSR, appels internes des `load`) voit le même joueur.
 */
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

  const others = (event.node.req.headers.cookie ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part && !part.startsWith(`${PLAYER_COOKIE}=`));
  event.node.req.headers.cookie = [...others, `${PLAYER_COOKIE}=${id}`].join('; ');
  return id;
}
