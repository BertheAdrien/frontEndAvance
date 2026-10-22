// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { buildLevels } from './catalog';

describe('buildLevels', () => {
  it('dérive des flags stables pour un même secret, au format BREACH{…}', () => {
    const flags = buildLevels('secret-a').map((l) => l.flag);

    expect(flags.length).toBeGreaterThan(0);
    flags.forEach((flag) => expect(flag).toMatch(/^BREACH\{[a-z0-9_]+\}$/));
    expect(buildLevels('secret-a').map((l) => l.flag)).toEqual(flags);
  });

  it('change tous les flags quand le secret change (aucun flag devinable depuis le dépôt)', () => {
    const a = buildLevels('secret-a');
    const b = buildLevels('secret-b');

    a.forEach((level, i) => expect(level.flag).not.toBe(b[i]?.flag));
  });
});
