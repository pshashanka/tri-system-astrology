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

type HeaderValue = string | string[] | undefined;
type HeaderMap = Headers | Record<string, HeaderValue>;

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
 * Extract client IP from proxied request headers.
 */
export function getClientIp(headers: HeaderMap, socketAddress?: string): string {
  const forwarded = getHeader(headers, 'x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();

  const realIp = getHeader(headers, 'x-real-ip');
  if (realIp) return realIp;

  return socketAddress || 'unknown';
}

function getHeader(headers: HeaderMap, name: string): string | undefined {
  if (headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }

  const value = headers[name.toLowerCase()] ?? headers[name];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}
