/**
 * Rate limiter backed by Upstash Redis (works on serverless).
 * Falls back to allow-all in development when env vars are missing.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export interface RateLimitResult {
  success: boolean;
  remaining: number;
}

let ratelimit: Ratelimit | null = null;

function getRatelimit(): Ratelimit | null {
  if (ratelimit) return ratelimit;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  ratelimit = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(10, '60 s'),
    prefix: 'astro-ratelimit',
  });

  return ratelimit;
}

/**
 * Check rate limit for a given IP. Returns { success, remaining }.
 * If Upstash is not configured, allows all requests (dev mode).
 */
export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  const rl = getRatelimit();
  if (!rl) {
    // Dev mode: no Upstash configured — allow all requests
    return { success: true, remaining: 999 };
  }

  const result = await rl.limit(ip);
  return { success: result.success, remaining: result.remaining };
}

/**
 * Extract client IP from Next.js request headers.
 */
export function getClientIp(headers: Record<string, string | string[] | undefined>, socketAddress?: string): string {
  const forwarded = headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return socketAddress || 'unknown';
}
