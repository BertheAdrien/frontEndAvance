import type { DatabaseSync } from 'node:sqlite';
import { createError, defineEventHandler, readBody } from 'h3';
import { z } from 'zod';

import { PSEUDONYM_PATTERN, type LeaderboardEntry, type LeaderboardResponse, type PseudonymResponse } from '../shared/leaderboard';
import type { Level } from './levels/catalog';
import { getPlayerId } from './player';

const pseudonymSchema = z.object({ pseudonym: z.string().trim().regex(PSEUDONYM_PATTERN) });

/** Enregistre (ou remplace) le pseudonyme du joueur ; unicité insensible à la casse. */
export function setPseudonym(db: DatabaseSync, playerId: string, pseudonym: string): 'ok' | 'taken' {
  const owner = db.prepare('SELECT player_id FROM pseudonyms WHERE pseudonym = ?').get(pseudonym) as
    | { player_id: string }
    | undefined;
  if (owner && owner.player_id !== playerId) return 'taken';

  db.prepare(
    'INSERT INTO pseudonyms (player_id, pseudonym) VALUES (?, ?) ON CONFLICT (player_id) DO UPDATE SET pseudonym = excluded.pseudonym',
  ).run(playerId, pseudonym);
  return 'ok';
}

export function getPseudonym(db: DatabaseSync, playerId: string): string | null {
  const row = db.prepare('SELECT pseudonym FROM pseudonyms WHERE player_id = ?').get(playerId) as
    | { pseudonym: string }
    | undefined;
  return row?.pseudonym ?? null;
}

/**
 * Classement des joueurs ayant un pseudonyme : le plus de niveaux capturés d'abord,
 * puis le plus rapide à atteindre ce score. Seuls les niveaux du catalogue comptent.
 */
export function getLeaderboard(db: DatabaseSync, levels: Level[]): LeaderboardEntry[] {
  const ids = levels.map((level) => level.id);
  const placeholders = ids.map(() => '?').join(', ') || 'NULL';
  const rows = db
    .prepare(
      `SELECT p.pseudonym, COUNT(c.level_id) AS captured, MAX(c.captured_at) AS last_capture_at
       FROM pseudonyms p
       LEFT JOIN captures c ON c.player_id = p.player_id AND c.level_id IN (${placeholders})
       GROUP BY p.player_id
       ORDER BY captured DESC, last_capture_at IS NULL, last_capture_at ASC, p.pseudonym COLLATE NOCASE`,
    )
    .all(...ids) as { pseudonym: string; captured: number; last_capture_at: string | null }[];

  return rows.map((row, index) => ({
    rank: index + 1,
    pseudonym: row.pseudonym,
    captured: row.captured,
    // SQLite stocke « AAAA-MM-JJ HH:MM:SS » en UTC sans le dire : on l'expose en ISO 8601.
    lastCaptureAt: row.last_capture_at ? `${row.last_capture_at.replace(' ', 'T')}Z` : null,
  }));
}

/** Classement public : aucun identifiant de joueur n'en sort. */
export function createLeaderboardHandler(deps: { db: () => DatabaseSync; levels: () => Level[] }) {
  return defineEventHandler((): LeaderboardResponse => ({
    entries: getLeaderboard(deps.db(), deps.levels()),
    generatedAt: new Date().toISOString(),
  }));
}

export function createPseudonymGetHandler(deps: { db: () => DatabaseSync }) {
  return defineEventHandler((event): PseudonymResponse => ({ pseudonym: getPseudonym(deps.db(), getPlayerId(event)) }));
}

export function createPseudonymPostHandler(deps: { db: () => DatabaseSync }) {
  return defineEventHandler(async (event): Promise<PseudonymResponse> => {
    const parsed = pseudonymSchema.safeParse(await readBody(event).catch(() => undefined));
    if (!parsed.success) {
      throw createError({ statusCode: 400, message: 'Pseudonyme invalide : 3 à 20 lettres, chiffres, « _ » ou « - »' });
    }

    const { pseudonym } = parsed.data;
    if (setPseudonym(deps.db(), getPlayerId(event), pseudonym) === 'taken') {
      throw createError({ statusCode: 409, message: 'Ce pseudonyme est déjà pris' });
    }
    return { pseudonym };
  });
}
