// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';

import type { PublicLevel } from '../shared/level';
import { openDatabase } from './db';
import {
  deletePushSubscription,
  newlyUnlockedLevels,
  notifyPlayer,
  pushSubscriptionSchema,
  readVapidConfig,
  savePushSubscription,
} from './push';

const alice = '0b6f2c1e-6a0e-4d53-9d0a-3f4a7c2b9e11';
const bob = '7d1e4b2a-1c3f-4e5d-8a9b-0c1d2e3f4a5b';
const subscription = (endpoint = 'https://fcm.googleapis.com/fcm/send/abc') => ({
  endpoint,
  keys: { p256dh: 'BPublicKey', auth: 'secretAuth' },
});

const level = (id: string, status: PublicLevel['status']): PublicLevel => ({
  id,
  order: 0,
  theme: 'XSS',
  title: `Titre ${id}`,
  summary: '',
  instructions: '',
  story: '',
  status,
});

describe('pushSubscriptionSchema', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://wns2-par02p.notify.windows.com/w/?token=abc',
    'https://web.push.apple.com/abc',
  ])('accepte un abonnement d’un service push connu : %s', (endpoint) => {
    expect(pushSubscriptionSchema.safeParse(subscription(endpoint)).success).toBe(true);
  });

  it.each([
    ['http (non chiffré)', 'http://fcm.googleapis.com/fcm/send/abc'],
    ['hôte interne (SSRF)', 'https://169.254.169.254/latest/meta-data'],
    ['domaine qui imite un service push', 'https://fcm.googleapis.com.evil.example/x'],
    ['localhost', 'https://localhost:3000/api/levels'],
  ])('refuse un endpoint %s : le serveur y enverrait des requêtes', (_label, endpoint) => {
    expect(pushSubscriptionSchema.safeParse(subscription(endpoint)).success).toBe(false);
  });

  it('refuse un abonnement sans clés de chiffrement', () => {
    expect(pushSubscriptionSchema.safeParse({ endpoint: subscription().endpoint }).success).toBe(false);
  });
});

describe('abonnements en base', () => {
  let db: DatabaseSync;
  beforeEach(() => (db = openDatabase(':memory:')));

  it('n’envoie qu’aux abonnements du joueur, et retire ceux que le service push déclare expirés', async () => {
    savePushSubscription(db, alice, subscription('https://fcm.googleapis.com/fcm/send/actif'));
    savePushSubscription(db, alice, subscription('https://fcm.googleapis.com/fcm/send/expire'));
    savePushSubscription(db, bob, subscription('https://fcm.googleapis.com/fcm/send/bob'));
    const send = vi.fn(async (sub: { endpoint: string }, _payload: string) => {
      if (sub.endpoint.endsWith('expire')) throw Object.assign(new Error('Gone'), { statusCode: 410 });
    });

    await notifyPlayer(db, alice, { title: 'T', body: 'B', url: '/' }, send);
    expect(send.mock.calls.map(([sub]) => sub.endpoint).sort()).toEqual([
      'https://fcm.googleapis.com/fcm/send/actif',
      'https://fcm.googleapis.com/fcm/send/expire',
    ]);
    expect(JSON.parse(send.mock.calls[0][1])).toEqual({ title: 'T', body: 'B', url: '/' });

    send.mockClear();
    await notifyPlayer(db, alice, { title: 'T', body: 'B', url: '/' }, send);
    expect(send.mock.calls.map(([sub]) => sub.endpoint)).toEqual(['https://fcm.googleapis.com/fcm/send/actif']);
  });

  it('garde l’abonnement après une erreur passagère du service push', async () => {
    savePushSubscription(db, alice, subscription());
    const send = vi.fn().mockRejectedValue(Object.assign(new Error('Indisponible'), { statusCode: 503 }));

    await notifyPlayer(db, alice, { title: 'T', body: 'B', url: '/' }, send);
    await notifyPlayer(db, alice, { title: 'T', body: 'B', url: '/' }, send);

    expect(send).toHaveBeenCalledTimes(2);
  });

  it('ne laisse pas un joueur désabonner le navigateur d’un autre', async () => {
    savePushSubscription(db, bob, subscription());

    expect(deletePushSubscription(db, alice, subscription().endpoint)).toBe(false);
    expect(deletePushSubscription(db, bob, subscription().endpoint)).toBe(true);
  });

  it('rattache au dernier joueur un navigateur qui se réabonne', async () => {
    savePushSubscription(db, alice, subscription());
    savePushSubscription(db, bob, subscription());
    const send = vi.fn().mockResolvedValue(undefined);

    await notifyPlayer(db, alice, { title: 'T', body: 'B', url: '/' }, send);
    expect(send).not.toHaveBeenCalled();
  });
});

describe('newlyUnlockedLevels', () => {
  it('renvoie le niveau passé de verrouillé à disponible', () => {
    const before = [level('n1', 'available'), level('n2', 'locked'), level('n3', 'locked')];
    const after = [level('n1', 'captured'), level('n2', 'available'), level('n3', 'locked')];

    expect(newlyUnlockedLevels(before, after).map((l) => l.id)).toEqual(['n2']);
  });

  it('ne renvoie rien quand un flag déjà capturé est resoumis', () => {
    const levels = [level('n1', 'captured'), level('n2', 'available')];

    expect(newlyUnlockedLevels(levels, levels)).toEqual([]);
  });
});

describe('readVapidConfig', () => {
  it('désactive le push tant que les clés VAPID ne sont pas toutes fournies', () => {
    expect(readVapidConfig({ VAPID_PUBLIC_KEY: 'pub' })).toBeNull();
    expect(readVapidConfig({ VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: '', VAPID_SUBJECT: 'mailto:a@b.c' })).toBeNull();
  });

  it('lit les clés depuis l’environnement', () => {
    expect(
      readVapidConfig({ VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv', VAPID_SUBJECT: 'mailto:a@b.c' }),
    ).toEqual({ publicKey: 'pub', privateKey: 'priv', subject: 'mailto:a@b.c' });
  });
});
