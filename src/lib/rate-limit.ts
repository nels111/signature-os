/**
 * Simple in-memory rate limiter.
 * For production at scale, replace with Redis-backed.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup expired entries every 5 minutes
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 5 * 60 * 1000);
cleanup.unref(); // Don't block process exit

export interface RateLimitConfig {
  windowMs: number;   // time window in milliseconds
  maxRequests: number; // max requests per window
}

/**
 * Check if a request should be rate limited.
 * Returns { limited: false } if OK, or { limited: true, retryAfterMs } if blocked.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { limited: boolean; retryAfterMs?: number; remaining: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { limited: false, remaining: config.maxRequests - 1 };
  }

  if (entry.count >= config.maxRequests) {
    return {
      limited: true,
      retryAfterMs: entry.resetAt - now,
      remaining: 0,
    };
  }

  entry.count++;
  return { limited: false, remaining: config.maxRequests - entry.count };
}

// Pre-configured limits
export const RATE_LIMITS = {
  login: { windowMs: 15 * 60 * 1000, maxRequests: 10 },      // 10 attempts per 15 min
  api: { windowMs: 60 * 1000, maxRequests: 60 },              // 60 req/min
  quoteGenerate: { windowMs: 60 * 1000, maxRequests: 5 },     // 5 quotes/min
  firefliesSync: { windowMs: 5 * 60 * 1000, maxRequests: 1 }, // 1 sync per 5 min
  emailSend: { windowMs: 60 * 1000, maxRequests: 10 },        // 10 emails/min
};
