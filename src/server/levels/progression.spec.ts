// @vitest-environment node
import { describe, expect, it } from 'vitest';

import type { Level } from './catalog';
import { toPublicLevels } from './progression';

const level = (order: number): Level => ({
  id: `niveau-${order}`,
  order,
  theme: 'XSS',
  title: `Niveau ${order}`,
  summary: 'Résumé',
  instructions: '',
  story: '',
  flag: `BREACH{secret_${order}}`,
});

describe('toPublicLevels', () => {
  const levels = [level(2), level(1), level(3)];

  it('ne rend disponible que le premier niveau pour un nouveau joueur', () => {
    const result = toPublicLevels(levels, new Set());

    expect(result.map((l) => l.status)).toEqual(['available', 'locked', 'locked']);
  });

  it("déverrouille le niveau suivant quand le flag du précédent est capturé", () => {
    const result = toPublicLevels(levels, new Set(['niveau-1']));

    expect(result.map((l) => l.status)).toEqual(['captured', 'available', 'locked']);
  });

  it("garde un niveau verrouillé tant que le précédent n'est pas capturé, même si lui-même l'est", () => {
    // Capture incohérente (ex. donnée corrompue) : on ne saute pas d'étape.
    const result = toPublicLevels(levels, new Set(['niveau-3']));

    expect(result.map((l) => l.status)).toEqual(['available', 'locked', 'locked']);
  });

  it("n'expose jamais le flag au client", () => {
    const result = toPublicLevels(levels, new Set(['niveau-1']));

    expect(JSON.stringify(result)).not.toContain('BREACH{');
  });
});
