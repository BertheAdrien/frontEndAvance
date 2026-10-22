// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { createRateLimiter } from './rate-limit';

describe('createRateLimiter', () => {
  const setup = () => {
    let now = 0;
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000, now: () => now });
    return { limiter, advance: (ms: number) => (now += ms) };
  };

  it('bloque la tentative qui dépasse la limite et indique quand réessayer', () => {
    const { limiter, advance } = setup();
    limiter.hit('alice');
    advance(10_000);
    limiter.hit('alice');
    limiter.hit('alice');

    expect(limiter.hit('alice')).toEqual({ allowed: false, retryAfterSeconds: 50 });
  });

  it('autorise de nouveau une fois la fenêtre écoulée', () => {
    const { limiter, advance } = setup();
    for (let i = 0; i < 4; i++) limiter.hit('alice');
    advance(60_000);

    expect(limiter.hit('alice').allowed).toBe(true);
  });

  it("compte séparément chaque clé : un joueur bloqué ne pénalise pas les autres", () => {
    const { limiter } = setup();
    for (let i = 0; i < 4; i++) limiter.hit('alice');

    expect(limiter.hit('bob').allowed).toBe(true);
  });
});
