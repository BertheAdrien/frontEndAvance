import { timingSafeEqual } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

import type { PublicLevel } from '../../shared/level';
import type { Level } from './catalog';
import { toPublicLevels } from './progression';

export type FlagResult = 'captured' | 'wrong' | 'locked' | 'unknown';

function capturedLevelIds(db: DatabaseSync, playerId: string): Set<string> {
  const rows = db
    .prepare('SELECT level_id FROM captures WHERE player_id = ?')
    .all(playerId) as { level_id: string }[];
  return new Set(rows.map((row) => row.level_id));
}

export function getLevelsForPlayer(db: DatabaseSync, levels: Level[], playerId: string): PublicLevel[] {
  return toPublicLevels(levels, capturedLevelIds(db, playerId));
}

/** Comparaison en temps constant : la durée ne révèle pas le nombre de caractères corrects. */
function sameFlag(expected: string, candidate: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(candidate);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function submitFlag(
  db: DatabaseSync,
  levels: Level[],
  playerId: string,
  levelId: string,
  candidate: string,
): FlagResult {
  const level = levels.find((l) => l.id === levelId);
  if (!level) return 'unknown';

  const status = getLevelsForPlayer(db, levels, playerId).find((l) => l.id === levelId)?.status;
  if (status === 'locked') return 'locked';
  if (!sameFlag(level.flag, candidate.trim())) return 'wrong';

  db.prepare('INSERT OR IGNORE INTO captures (player_id, level_id) VALUES (?, ?)').run(playerId, levelId);
  return 'captured';
}
