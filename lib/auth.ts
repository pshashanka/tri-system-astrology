/**
 * Bearer token authentication for v1 API endpoints.
 * Validates Authorization header against ASTRO_API_KEY environment variable.
 */

import type { NextApiRequest } from 'next';

export interface AuthResult {
  valid: boolean;
  error?: string;
}

/**
 * Authenticate a request using Bearer token.
 * If ASTRO_API_KEY is not set, allows all requests (dev mode).
 */
export function authenticateRequest(req: NextApiRequest): AuthResult {
  const expectedKey = process.env.ASTRO_API_KEY;

  if (!expectedKey) {
    // Dev mode: no API key configured — allow all requests
    return { valid: true };
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return { valid: false, error: 'Missing Authorization header. Use: Bearer <API_KEY>' };
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return { valid: false, error: 'Invalid Authorization format. Use: Bearer <API_KEY>' };
  }

  // Constant-time comparison to prevent timing attacks
  const token = parts[1];
  if (token.length !== expectedKey.length || !timingSafeEqual(token, expectedKey)) {
    return { valid: false, error: 'Invalid API key' };
  }

  return { valid: true };
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
