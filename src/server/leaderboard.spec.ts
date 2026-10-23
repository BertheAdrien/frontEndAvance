// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, createRouter, toWebHandler } from 'h3';
import type { DatabaseSync } from 'node:sqlite';

import type { LeaderboardResponse, PseudonymResponse } from '../shared/leaderboard';
import { openDatabase } from './db';
import type { Level } from './levels/catalog';
import {
  createLeaderboardHandler,
  createPseudonymGetHandler,
  createPseudonymPostHandler,
  getLeaderboard,
  setPseudonym,
} from './leaderboard';
import { PLAYER_COOKIE } from './player';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

const level = (id: string, order: number): Level => ({
  id, order, theme: 'XSS stockée', title: '', summary: '', instructions: '', story: '', flag: `BREACH{${id}}`,
});
const levels = [level('un', 1), level('deux', 2)];

let db: DatabaseSync;
beforeEach(() => {
  db = openDatabase(':memory:');
});
afterEach(() => db.close());

function capture(player: string, levelId: string, at: string): void {
  db.prepare('INSERT INTO captures (player_id, level_id, captured_at) VALUES (?, ?, ?)').run(player, levelId, at);
}

describe('getLeaderboard', () => {
  it('classe par niveaux capturés puis par date de dernière capture (le plus rapide devant), dates en ISO UTC', () => {
    setPseudonym(db, A, 'alice');
    setPseudonym(db, B, 'bob');
    setPseudonym(db, C, 'chloe');
    capture(A, 'un', '2026-10-01 10:00:00');
    capture(B, 'un', '2026-10-01 09:00:00');
    capture(B, 'deux', '2026-10-01 11:00:00');
    capture(C, 'un', '2026-10-01 09:30:00');

    expect(getLeaderboard(db, levels)).toEqual([
      { rank: 1, pseudonym: 'bob', captured: 2, lastCaptureAt: '2026-10-01T11:00:00Z' },
      { rank: 2, pseudonym: 'chloe', captured: 1, lastCaptureAt: '2026-10-01T09:30:00Z' },
      { rank: 3, pseudonym: 'alice', captured: 1, lastCaptureAt: '2026-10-01T10:00:00Z' },
    ]);
  });

  it("n'affiche que les joueurs ayant choisi un pseudonyme, même sans capture", () => {
    capture(A, 'un', '2026-10-01 10:00:00');
    setPseudonym(db, B, 'bob');

    expect(getLeaderboard(db, levels)).toEqual([{ rank: 1, pseudonym: 'bob', captured: 0, lastCaptureAt: null }]);
  });

  it('ignore les captures de niveaux absents du catalogue', () => {
    setPseudonym(db, A, 'alice');
    capture(A, 'retire', '2026-10-01 10:00:00');

    expect(getLeaderboard(db, levels)[0]).toMatchObject({ captured: 0, lastCaptureAt: null });
  });
});

describe('setPseudonym', () => {
  it('remplace le pseudonyme du joueur', () => {
    setPseudonym(db, A, 'alice');
    expect(setPseudonym(db, A, 'alicia')).toBe('ok');
    expect(getLeaderboard(db, levels).map((e) => e.pseudonym)).toEqual(['alicia']);
  });

  it("refuse un pseudonyme déjà pris par un autre joueur, sans tenir compte de la casse", () => {
    setPseudonym(db, A, 'alice');
    expect(setPseudonym(db, B, 'ALICE')).toBe('taken');
    expect(setPseudonym(db, A, 'Alice')).toBe('ok');
  });
});

describe('routes /api/classement', () => {
  const app = toWebHandler(
    createApp().use(
      createRouter()
        .get('/classement', createLeaderboardHandler({ db: () => db, levels: () => levels }))
        .get('/pseudo', createPseudonymGetHandler({ db: () => db }))
        .post('/pseudo', createPseudonymPostHandler({ db: () => db })),
    ),
  );
  const postPseudo = (player: string, body: unknown) =>
    app(
      new Request('http://localhost/pseudo', {
        method: 'POST',
        headers: { cookie: `${PLAYER_COOKIE}=${player}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );

  it('enregistre le pseudonyme du joueur identifié par son cookie, sans espaces autour', async () => {
    const res = await postPseudo(A, { pseudonym: '  alice_42 ' });
    expect(res.status).toBe(200);
    expect((await res.json()) as PseudonymResponse).toEqual({ pseudonym: 'alice_42' });

    const mine = await app(new Request('http://localhost/pseudo', { headers: { cookie: `${PLAYER_COOKIE}=${A}` } }));
    expect(await mine.json()).toEqual({ pseudonym: 'alice_42' });
  });

  it.each([['ab'], ['a'.repeat(21)], ['<img src=x>'], ['alice bob'], [42]])('refuse le pseudonyme %j (400)', async (pseudonym) => {
    const res = await postPseudo(A, { pseudonym });
    expect(res.status).toBe(400);
    expect(getLeaderboard(db, levels)).toEqual([]);
  });

  it('accepte les lettres accentuées', async () => {
    expect((await postPseudo(A, { pseudonym: 'Zoé-é' })).status).toBe(200);
  });

  it('répond 409 si le pseudonyme est pris', async () => {
    await postPseudo(A, { pseudonym: 'alice' });
    expect((await postPseudo(B, { pseudonym: 'Alice' })).status).toBe(409);
  });

  it("ne révèle ni l'identifiant ni le cookie des joueurs dans le classement public", async () => {
    setPseudonym(db, A, 'alice');
    const res = await app(new Request('http://localhost/classement'));
    const body = (await res.json()) as LeaderboardResponse;

    expect(body.entries).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain(A);
    expect(Number.isNaN(Date.parse(body.generatedAt))).toBe(false);
  });
});
