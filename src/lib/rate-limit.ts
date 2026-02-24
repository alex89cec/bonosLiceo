// Simple in-memory rate limiter for API routes.
// For production, use Redis or Vercel KV.

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

const MAX_REQUESTS = parseInt(
  process.env.RATE_LIMIT_RESERVATION_MAX || "5",
  10,
);
const WINDOW_MS = parseInt(
  process.env.RATE_LIMIT_RESERVATION_WINDOW_MS || "60000",
  10,
);

export function rateLimit(key: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + WINDOW_MS;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: MAX_REQUESTS - 1, resetAt };
  }

  if (entry.count >= MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: MAX_REQUESTS - entry.count,
    resetAt: entry.resetAt,
  };
}

// Periodic cleanup of expired entries
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now > entry.resetAt) {
        store.delete(key);
      }
    }
  },
  5 * 60 * 1000,
);
