export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  hit(key: string): RateLimitResult;
}

/**
 * Limiteur à fenêtre glissante, en mémoire (suffisant pour une seule instance du serveur).
 */
export function createRateLimiter({
  limit,
  windowMs,
  now = Date.now,
}: {
  limit: number;
  windowMs: number;
  now?: () => number;
}): RateLimiter {
  const attempts = new Map<string, number[]>();

  return {
    hit(key) {
      const current = now();
      const recent = (attempts.get(key) ?? []).filter((time) => current - time < windowMs);

      if (recent.length >= limit) {
        attempts.set(key, recent);
        const oldest = recent[0] ?? current;
        return { allowed: false, retryAfterSeconds: Math.ceil((oldest + windowMs - current) / 1000) };
      }

      recent.push(current);
      attempts.set(key, recent);
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}
