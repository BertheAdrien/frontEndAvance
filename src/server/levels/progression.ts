import type { LevelStatus, PublicLevel } from '../../shared/level';
import type { Level } from './catalog';

/**
 * Calcule l'état de chaque niveau pour un joueur et retire les flags.
 * Un niveau n'est accessible que si tous les précédents sont capturés.
 */
export function toPublicLevels(levels: Level[], captured: Set<string>): PublicLevel[] {
  const sorted = [...levels].sort((a, b) => a.order - b.order);
  let previousCaptured = true;

  return sorted.map(({ flag: _flag, ...level }) => {
    let status: LevelStatus = 'locked';
    if (previousCaptured) {
      status = captured.has(level.id) ? 'captured' : 'available';
    }
    previousCaptured = status === 'captured';
    return { ...level, status };
  });
}
