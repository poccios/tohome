import { FastifyRequest, FastifyReply } from 'fastify';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitStore {
  oneMinute: Map<string, RateLimitEntry>;
  tenMinutes: Map<string, RateLimitEntry>;
  oneDay: Map<string, RateLimitEntry>;
}

const store: RateLimitStore = {
  oneMinute: new Map(),
  tenMinutes: new Map(),
  oneDay: new Map(),
};

// Cleanup expired entries every minute
setInterval(() => {
  const now = Date.now();

  // Cleanup 1-minute store
  for (const [key, entry] of store.oneMinute.entries()) {
    if (entry.resetAt < now) {
      store.oneMinute.delete(key);
    }
  }

  // Cleanup 10-minute store
  for (const [key, entry] of store.tenMinutes.entries()) {
    if (entry.resetAt < now) {
      store.tenMinutes.delete(key);
    }
  }

  // Cleanup 1-day store
  for (const [key, entry] of store.oneDay.entries()) {
    if (entry.resetAt < now) {
      store.oneDay.delete(key);
    }
  }
}, 60000); // Run every minute

function getRateLimitKey(ip: string, email: string): string {
  return `${ip}:${email}`;
}

export async function authRequestRateLimit(
  request: FastifyRequest<{
    Body: { email?: string };
  }>,
  reply: FastifyReply
) {
  const ip = request.ip;
  const email = request.body.email;

  if (!email) {
    // Let validation handle missing email
    return;
  }

  const key = getRateLimitKey(ip, email);
  const now = Date.now();

  // Check 1 request per minute limit
  const oneMinuteEntry = store.oneMinute.get(key);
  if (oneMinuteEntry && oneMinuteEntry.resetAt > now) {
    return reply.status(429).send({
      error: 'Too many requests',
      message: 'Please wait 1 minute before requesting another login link',
      retryAfter: Math.ceil((oneMinuteEntry.resetAt - now) / 1000),
    });
  }

  // Check 3 requests per 10 minutes limit
  const tenMinuteEntry = store.tenMinutes.get(key);
  if (tenMinuteEntry) {
    if (tenMinuteEntry.resetAt > now) {
      if (tenMinuteEntry.count >= 3) {
        return reply.status(429).send({
          error: 'Too many requests',
          message: 'Maximum 3 login requests per 10 minutes exceeded',
          retryAfter: Math.ceil((tenMinuteEntry.resetAt - now) / 1000),
        });
      }
      // Increment count
      tenMinuteEntry.count++;
    } else {
      // Reset window
      store.tenMinutes.set(key, {
        count: 1,
        resetAt: now + 10 * 60 * 1000, // 10 minutes
      });
    }
  } else {
    // First request in 10-minute window
    store.tenMinutes.set(key, {
      count: 1,
      resetAt: now + 10 * 60 * 1000,
    });
  }

  // Check 10 requests per day limit
  const oneDayEntry = store.oneDay.get(key);
  if (oneDayEntry) {
    if (oneDayEntry.resetAt > now) {
      if (oneDayEntry.count >= 10) {
        return reply.status(429).send({
          error: 'Too many requests',
          message: 'Maximum 10 login requests per day exceeded',
          retryAfter: Math.ceil((oneDayEntry.resetAt - now) / 1000),
        });
      }
      // Increment count
      oneDayEntry.count++;
    } else {
      // Reset window
      store.oneDay.set(key, {
        count: 1,
        resetAt: now + 24 * 60 * 60 * 1000, // 24 hours
      });
    }
  } else {
    // First request in 24-hour window
    store.oneDay.set(key, {
      count: 1,
      resetAt: now + 24 * 60 * 60 * 1000,
    });
  }

  // Set 1-minute limit
  store.oneMinute.set(key, {
    count: 1,
    resetAt: now + 60 * 1000, // 1 minute
  });
}

// For testing: reset all rate limits
export function resetRateLimits() {
  store.oneMinute.clear();
  store.tenMinutes.clear();
  store.oneDay.clear();
}

// For testing: reset only 1-minute limit (keeps 10-minute counter)
export function resetOneMinuteLimit() {
  store.oneMinute.clear();
}
