/**
 * CORS middleware for v1 API endpoints.
 * Whitelists OpenAI GPT Action origins + allows local development.
 */

const ALLOWED_ORIGINS = new Set([
  'https://chatgpt.com',
  'https://chat.openai.com',
]);

function getConfiguredOrigins(): string[] {
  const configured = process.env.CORS_ALLOWED_ORIGINS;
  if (!configured) {
    return [];
  }

  return configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isAllowedOrigin(origin: string): boolean {
  if (!origin) {
    return false;
  }

  return (
    process.env.NODE_ENV === 'development' ||
    ALLOWED_ORIGINS.has(origin) ||
    origin.endsWith('.railway.app') ||
    origin.endsWith('.up.railway.app') ||
    getConfiguredOrigins().includes(origin)
  );
}

/**
 * Build CORS headers for API responses and OPTIONS preflights.
 */
export function createCorsHeaders(origin: string): Headers {
  const headers = new Headers();

  if (isAllowedOrigin(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
  }

  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Expose-Headers', 'X-RateLimit-Remaining');
  headers.set('Access-Control-Max-Age', '86400');

  return headers;
}
