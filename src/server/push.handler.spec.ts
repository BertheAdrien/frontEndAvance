// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { createApp, createRouter, toWebHandler } from 'h3';

import { openDatabase } from './db';
import { PLAYER_COOKIE } from './player';
import { notifyPlayer } from './push';
import { createSubscribeHandler, createUnsubscribeHandler } from './push.handler';

const alice = '0b6f2c1e-6a0e-4d53-9d0a-3f4a7c2b9e11';
const endpoint = 'https://fcm.googleapis.com/fcm/send/abc';

describe('API des abonnements push', () => {
  let db: DatabaseSync;
  let handler: (request: Request) => Promise<Response>;

  beforeEach(() => {
    db = openDatabase(':memory:');
    const router = createRouter()
      .post('/api/push/abonnement', createSubscribeHandler({ db: () => db }))
      .delete('/api/push/abonnement', createUnsubscribeHandler({ db: () => db }));
    handler = toWebHandler(createApp().use(router));
  });

  const call = (method: string, body: unknown) =>
    handler(
      new Request('http://localhost/api/push/abonnement', {
        method,
        headers: { 'content-type': 'application/json', cookie: `${PLAYER_COOKIE}=${alice}` },
        body: JSON.stringify(body),
      }),
    );
  const sentTo = async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    await notifyPlayer(db, alice, { title: 'T', body: 'B', url: '/' }, send);
    return send.mock.calls.map(([sub]) => sub.endpoint);
  };

  it('enregistre l’abonnement du joueur, puis l’oublie quand il se désabonne', async () => {
    expect((await call('POST', { endpoint, keys: { p256dh: 'p', auth: 'a' } })).status).toBe(201);
    expect(await sentTo()).toEqual([endpoint]);

    expect((await call('DELETE', { endpoint })).status).toBe(204);
    expect(await sentTo()).toEqual([]);
  });

  it('rejette en 400 un endpoint hors des services push, sans rien enregistrer', async () => {
    const response = await call('POST', { endpoint: 'https://169.254.169.254/x', keys: { p256dh: 'p', auth: 'a' } });

    expect(response.status).toBe(400);
    expect(await sentTo()).toEqual([]);
  });
});
