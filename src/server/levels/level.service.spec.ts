// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';

import { openDatabase } from '../db';
import type { Level } from './catalog';
import { getLevelsForPlayer, submitFlag } from './level.service';

const levels: Level[] = [
  { id: 'n1', order: 1, theme: 'XSS', title: 'N1', summary: '', story: '', flag: 'BREACH{un}' },
  { id: 'n2', order: 2, theme: 'CSP', title: 'N2', summary: '', story: '', flag: 'BREACH{deux}' },
];

describe('service des niveaux (SQLite en mémoire)', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = openDatabase(':memory:');
  });

  const statuses = (player: string) => getLevelsForPlayer(db, levels, player).map((l) => l.status);

  it('enregistre un flag correct et déverrouille le niveau suivant', () => {
    expect(submitFlag(db, levels, 'alice', 'n1', 'BREACH{un}')).toBe('captured');

    expect(statuses('alice')).toEqual(['captured', 'available']);
  });

  it("refuse un flag incorrect sans rien enregistrer", () => {
    expect(submitFlag(db, levels, 'alice', 'n1', 'BREACH{faux}')).toBe('wrong');

    expect(statuses('alice')).toEqual(['available', 'locked']);
  });

  it("refuse le bon flag d'un niveau encore verrouillé", () => {
    expect(submitFlag(db, levels, 'alice', 'n2', 'BREACH{deux}')).toBe('locked');

    expect(statuses('alice')).toEqual(['available', 'locked']);
  });

  it('répond « unknown » pour un niveau inexistant', () => {
    expect(submitFlag(db, levels, 'alice', 'n99', 'BREACH{un}')).toBe('unknown');
  });

  it('accepte une seconde soumission du même flag sans erreur', () => {
    submitFlag(db, levels, 'alice', 'n1', 'BREACH{un}');

    expect(submitFlag(db, levels, 'alice', 'n1', 'BREACH{un}')).toBe('captured');
  });

  it("isole la progression de chaque joueur", () => {
    submitFlag(db, levels, 'alice', 'n1', 'BREACH{un}');

    expect(statuses('bob')).toEqual(['available', 'locked']);
  });
});
