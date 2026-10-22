// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { createApp, createRouter, toWebHandler } from 'h3';

import { openDatabase } from '../db';
import { PLAYER_COOKIE } from '../player';
import { createRateLimiter } from '../rate-limit';
import type { Level } from './catalog';
import { createFlagHandler } from './flag.handler';
import { getLevelsForPlayer } from './level.service';

const levels: Level[] = [
  { id: 'n1', order: 1, theme: 'XSS', title: 'N1', summary: '', instructions: '', story: '', flag: 'BREACH{un}' },
  { id: 'n2', order: 2, theme: 'CSP', title: 'N2', summary: '', instructions: '', story: '', flag: 'BREACH{deux}' },
];
const alice = '0b6f2c1e-6a0e-4d53-9d0a-3f4a7c2b9e11';

describe('POST /api/levels/:id/flag', () => {
  let db: DatabaseSync;
  let handler: (request: Request) => Promise<Response>;

  beforeEach(() => {
    db = openDatabase(':memory:');
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });
    handler = toWebHandler(
      createApp().use(
        createRouter().post('/api/levels/:id/flag', createFlagHandler({ db: () => db, levels: () => levels, limiter })),
      ),
    );
  });

  const submit = (levelId: string, body: unknown) =>
    handler(
      new Request(`http://localhost/api/levels/${levelId}/flag`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: `${PLAYER_COOKIE}=${alice}` },
        body: JSON.stringify(body),
      }),
    );
  const statuses = () => getLevelsForPlayer(db, levels, alice).map((l) => l.status);

  it('capture le flag et renvoie la progression mise à jour, sans aucun flag', async () => {
    const response = await submit('n1', { flag: '  BREACH{un} ' });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.result).toBe('captured');
    expect(body.levels.map((l: { status: string }) => l.status)).toEqual(['captured', 'available']);
    expect(JSON.stringify(body)).not.toContain('BREACH{');
  });

  it('signale un flag incorrect sans rien enregistrer', async () => {
    const response = await submit('n1', { flag: 'BREACH{faux}' });

    expect((await response.json()).result).toBe('wrong');
    expect(statuses()).toEqual(['available', 'locked']);
  });

  it.each([
    ['absent', {}],
    ['pas une chaîne', { flag: { $ne: '' } }],
    ['vide', { flag: '   ' }],
    ['trop long', { flag: 'B'.repeat(201) }],
  ])('rejette en 400 un flag %s', async (_label, body) => {
    expect((await submit('n1', body)).status).toBe(400);
    expect(statuses()).toEqual(['available', 'locked']);
  });

  it("répond 403 pour le bon flag d'un niveau encore verrouillé", async () => {
    expect((await submit('n2', { flag: 'BREACH{deux}' })).status).toBe(403);
    expect(statuses()).toEqual(['available', 'locked']);
  });

  it('répond 404 pour un niveau inexistant', async () => {
    expect((await submit('n99', { flag: 'BREACH{un}' })).status).toBe(404);
  });

  it('bloque la force brute : au-delà de la limite, même le bon flag est refusé en 429', async () => {
    for (let i = 0; i < 3; i++) await submit('n1', { flag: `BREACH{essai_${i}}` });

    const response = await submit('n1', { flag: 'BREACH{un}' });

    expect(response.status).toBe(429);
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(statuses()).toEqual(['available', 'locked']);
  });
});
