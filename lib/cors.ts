/**
 * CORS middleware for v1 API endpoints.
 * Whitelists OpenAI GPT Action origins + allows local development.
 */

import type { NextApiRequest, NextApiResponse } from 'next';

const ALLOWED_ORIGINS = new Set([
  'https://chatgpt.com',
  'https://chat.openai.com',
]);

/**
 * Apply CORS headers. Returns true if this was an OPTIONS preflight (caller should return early).
 */
export function applyCors(req: NextApiRequest, res: NextApiResponse): boolean {
  const origin = req.headers.origin || '';

  // In development, allow any origin; in production, whitelist
  const isAllowed =
    process.env.NODE_ENV === 'development' ||
    ALLOWED_ORIGINS.has(origin) ||
    origin.endsWith('.vercel.app');

  if (isAllowed && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Expose-Headers', 'X-RateLimit-Remaining');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }

  return false;
}
